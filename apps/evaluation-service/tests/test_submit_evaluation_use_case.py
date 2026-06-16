from dataclasses import dataclass, field
from datetime import UTC, datetime

import pytest

from application.ports import Clock, IdGenerator
from application.result import Failure, Success
from application.submit_evaluation_use_case import (
    SubmitEvaluationCommand,
    SubmitEvaluationUseCase,
)
from domain.evaluation import Evaluation
from infrastructure.contracts import ActorContext, DomainEvent


@dataclass(slots=True)
class InMemoryEvaluationRepository:
    evaluations: list[Evaluation] = field(default_factory=list)

    async def save(self, *, evaluation: Evaluation) -> None:
        self.evaluations.append(evaluation)

    async def find_by_submission_id(self, *, submission_id: str) -> tuple[Evaluation, ...]:
        return tuple(
            evaluation
            for evaluation in self.evaluations
            if evaluation.submission_id == submission_id
        )


@dataclass(slots=True)
class InMemoryEventPublisher:
    events: list[DomainEvent] = field(default_factory=list)

    async def publish(self, *, event: DomainEvent) -> None:
        self.events.append(event)


@dataclass(frozen=True, slots=True)
class FixedClock(Clock):
    fixed_now: datetime

    def now(self) -> datetime:
        return self.fixed_now


@dataclass(slots=True)
class SequentialIdGenerator(IdGenerator):
    ids: list[str]

    def generate(self) -> str:
        return self.ids.pop(0)


fixed_now = datetime(2026, 6, 16, 10, 0, 0, tzinfo=UTC)


def create_use_case(
    *,
    repository: InMemoryEvaluationRepository | None = None,
    publisher: InMemoryEventPublisher | None = None,
) -> tuple[SubmitEvaluationUseCase, InMemoryEvaluationRepository, InMemoryEventPublisher]:
    evaluation_repository = repository if repository is not None else InMemoryEvaluationRepository()
    event_publisher = publisher if publisher is not None else InMemoryEventPublisher()
    use_case = SubmitEvaluationUseCase(
        clock=FixedClock(fixed_now=fixed_now),
        evaluation_repository=evaluation_repository,
        event_publisher=event_publisher,
        id_generator=SequentialIdGenerator(
            ids=[
                "evaluation-2b6c2fed-89d4-4f9b-9cbf-c6d5da96af58",
                "event-2b6c2fed-89d4-4f9b-9cbf-c6d5da96af58",
            ]
        ),
    )

    return use_case, evaluation_repository, event_publisher


@pytest.mark.asyncio
async def test_reviewer_can_submit_evaluation() -> None:
    use_case, repository, publisher = create_use_case()

    result = await use_case.execute(
        command=SubmitEvaluationCommand(
            actor=ActorContext(
                user_id="user-reviewer",
                organization_id="org-reviewer",
                role="reviewer",
            ),
            submission_id="f5f8f358-2fd4-4ef2-9720-91b9e96c8c64",
            score=91,
            comment="Strong strategic fit.",
            correlation_id="correlation-id",
        )
    )

    assert isinstance(result, Success)
    assert result.value.id == "evaluation-2b6c2fed-89d4-4f9b-9cbf-c6d5da96af58"
    assert result.value.recommendation == "strong-fit"
    assert result.value.created_at == fixed_now
    assert len(repository.evaluations) == 1
    assert len(publisher.events) == 1
    assert publisher.events[0].eventId == "event-2b6c2fed-89d4-4f9b-9cbf-c6d5da96af58"
    assert publisher.events[0].occurredAt == "2026-06-16T10:00:00+00:00"


@pytest.mark.asyncio
async def test_non_reviewer_cannot_submit_evaluation() -> None:
    use_case, repository, publisher = create_use_case()

    result = await use_case.execute(
        command=SubmitEvaluationCommand(
            actor=ActorContext(
                user_id="user-company-admin",
                organization_id="org-company",
                role="company-admin",
            ),
            submission_id="f5f8f358-2fd4-4ef2-9720-91b9e96c8c64",
            score=91,
            comment="Strong strategic fit.",
            correlation_id="correlation-id",
        )
    )

    assert isinstance(result, Failure)
    assert result.error == "forbidden"
    assert len(repository.evaluations) == 0
    assert len(publisher.events) == 0


@pytest.mark.asyncio
async def test_rejects_score_out_of_range() -> None:
    use_case, repository, publisher = create_use_case()

    result = await use_case.execute(
        command=SubmitEvaluationCommand(
            actor=ActorContext(
                user_id="user-reviewer",
                organization_id="org-reviewer",
                role="reviewer",
            ),
            submission_id="f5f8f358-2fd4-4ef2-9720-91b9e96c8c64",
            score=101,
            comment="Strong strategic fit.",
            correlation_id="correlation-id",
        )
    )

    assert isinstance(result, Failure)
    assert result.error == "evaluation-score-out-of-range"
    assert len(repository.evaluations) == 0
    assert len(publisher.events) == 0


@pytest.mark.asyncio
async def test_rejects_empty_comment() -> None:
    use_case, repository, publisher = create_use_case()

    result = await use_case.execute(
        command=SubmitEvaluationCommand(
            actor=ActorContext(
                user_id="user-reviewer",
                organization_id="org-reviewer",
                role="reviewer",
            ),
            submission_id="f5f8f358-2fd4-4ef2-9720-91b9e96c8c64",
            score=91,
            comment=" ",
            correlation_id="correlation-id",
        )
    )

    assert isinstance(result, Failure)
    assert result.error == "evaluation-comment-required"
    assert len(repository.evaluations) == 0
    assert len(publisher.events) == 0

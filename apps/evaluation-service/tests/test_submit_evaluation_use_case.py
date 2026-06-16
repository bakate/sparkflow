from dataclasses import dataclass, field

import pytest

from src.application.result import Failure, Success
from src.application.submit_evaluation_use_case import (
    SubmitEvaluationCommand,
    SubmitEvaluationUseCase,
)
from src.domain.evaluation import Evaluation
from src.infrastructure.contracts import ActorContext, DomainEvent


@dataclass(slots=True)
class InMemoryEvaluationRepository:
    evaluations: list[Evaluation] = field(default_factory=list)

    async def save(self, *, evaluation: Evaluation) -> None:
        self.evaluations.append(evaluation)

    async def find_by_submission_id(self, *, submission_id: str) -> tuple[Evaluation, ...]:
        return tuple(evaluation for evaluation in self.evaluations if evaluation.submission_id == submission_id)


@dataclass(slots=True)
class InMemoryEventPublisher:
    events: list[DomainEvent] = field(default_factory=list)

    async def publish(self, *, event: DomainEvent) -> None:
        self.events.append(event)


@pytest.mark.asyncio
async def test_reviewer_can_submit_evaluation() -> None:
    repository = InMemoryEvaluationRepository()
    publisher = InMemoryEventPublisher()
    use_case = SubmitEvaluationUseCase(
        evaluation_repository=repository,
        event_publisher=publisher,
    )

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
    assert result.value.recommendation == "strong-fit"
    assert len(repository.evaluations) == 1
    assert len(publisher.events) == 1


@pytest.mark.asyncio
async def test_non_reviewer_cannot_submit_evaluation() -> None:
    use_case = SubmitEvaluationUseCase(
        evaluation_repository=InMemoryEvaluationRepository(),
        event_publisher=InMemoryEventPublisher(),
    )

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

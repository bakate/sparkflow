from dataclasses import dataclass
from typing import Literal
from uuid import uuid4

from application.ports import EvaluationRepository, EventPublisher
from application.result import Failure, Result, Success
from domain.evaluation import Evaluation, create_evaluation
from infrastructure.contracts import (
    ActorContext,
    DomainEvent,
    EvaluationSubmittedPayload,
)

SubmitEvaluationError = Literal[
    "forbidden",
    "evaluation-score-out-of-range",
    "evaluation-comment-required",
]


@dataclass(frozen=True, slots=True)
class SubmitEvaluationCommand:
    actor: ActorContext
    submission_id: str
    score: int
    comment: str
    correlation_id: str


class SubmitEvaluationUseCase:
    def __init__(
        self,
        *,
        evaluation_repository: EvaluationRepository,
        event_publisher: EventPublisher,
    ) -> None:
        self._evaluation_repository = evaluation_repository
        self._event_publisher = event_publisher

    async def execute(
        self,
        *,
        command: SubmitEvaluationCommand,
    ) -> Result[SubmitEvaluationError, Evaluation]:
        if command.actor.role != "reviewer":
            return Failure(error="forbidden")

        if command.score < 0 or command.score > 100:
            return Failure(error="evaluation-score-out-of-range")

        if len(command.comment.strip()) == 0:
            return Failure(error="evaluation-comment-required")

        evaluation = create_evaluation(
            evaluation_id=str(uuid4()),
            submission_id=command.submission_id,
            reviewer_id=command.actor.user_id,
            score=command.score,
            comment=command.comment,
        )

        await self._evaluation_repository.save(evaluation=evaluation)
        await self._event_publisher.publish(
            event=DomainEvent(
                eventId=str(uuid4()),
                eventName="evaluation.submitted",
                occurredAt=evaluation.created_at.isoformat(),
                correlationId=command.correlation_id,
                producer="evaluation-service",
                payload=EvaluationSubmittedPayload.from_evaluation(evaluation=evaluation),
            )
        )

        return Success(value=evaluation)

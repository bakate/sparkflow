from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from domain.evaluation import Evaluation, EvaluationRecommendation

UserRole = Literal["company-admin", "startup-member", "reviewer"]
EventName = Literal[
    "challenge.published",
    "submission.created",
    "evaluation.submitted",
    "submission.accepted",
    "submission.rejected",
    "notification.created",
]


class ActorContext(BaseModel):
    model_config = ConfigDict(frozen=True)

    user_id: str
    organization_id: str
    role: UserRole


class EvaluationSubmittedPayload(BaseModel):
    model_config = ConfigDict(frozen=True, populate_by_name=True)

    id: str
    submission_id: str = Field(validation_alias="submissionId", serialization_alias="submissionId")
    reviewer_id: str = Field(validation_alias="reviewerId", serialization_alias="reviewerId")
    score: int
    recommendation: EvaluationRecommendation
    comment: str
    created_at: str = Field(validation_alias="createdAt", serialization_alias="createdAt")

    @classmethod
    def from_evaluation(cls, *, evaluation: Evaluation) -> "EvaluationSubmittedPayload":
        return cls(
            id=evaluation.id,
            submission_id=evaluation.submission_id,
            reviewer_id=evaluation.reviewer_id,
            score=evaluation.score,
            recommendation=evaluation.recommendation,
            comment=evaluation.comment,
            created_at=evaluation.created_at.isoformat(),
        )


class DomainEvent(BaseModel):
    model_config = ConfigDict(frozen=True, populate_by_name=True)

    eventId: str
    eventName: EventName
    occurredAt: str
    correlationId: str
    producer: str
    payload: BaseModel | dict[str, Any]

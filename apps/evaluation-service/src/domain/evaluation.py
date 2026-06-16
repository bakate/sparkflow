from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal

EvaluationRecommendation = Literal["strong-fit", "possible-fit", "not-fit"]


@dataclass(frozen=True, slots=True)
class Evaluation:
    id: str
    submission_id: str
    reviewer_id: str
    score: int
    recommendation: EvaluationRecommendation
    comment: str
    created_at: datetime


def create_evaluation(
    *,
    evaluation_id: str,
    submission_id: str,
    reviewer_id: str,
    score: int,
    comment: str,
) -> Evaluation:
    return Evaluation(
        id=evaluation_id,
        submission_id=submission_id,
        reviewer_id=reviewer_id,
        score=score,
        recommendation=score_to_recommendation(score=score),
        comment=comment.strip(),
        created_at=datetime.now(UTC),
    )


def score_to_recommendation(*, score: int) -> EvaluationRecommendation:
    if score >= 80:
        return "strong-fit"

    if score >= 50:
        return "possible-fit"

    return "not-fit"

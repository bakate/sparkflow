import os
from typing import Annotated, cast

import asyncpg
from fastapi import FastAPI, Header, HTTPException, Response, status
from pydantic import BaseModel, Field

from application.result import Failure, Success
from application.submit_evaluation_use_case import (
    SubmitEvaluationCommand,
    SubmitEvaluationUseCase,
)
from domain.evaluation import Evaluation
from infrastructure.contracts import ActorContext, EvaluationSubmittedPayload, UserRole
from infrastructure.nats_event_publisher import create_nats_event_publisher
from infrastructure.postgres_evaluation_repository import (
    PostgresEvaluationRepository,
    ensure_evaluation_schema,
)


class SubmitEvaluationRequest(BaseModel):
    score: int = Field(ge=0, le=100)
    comment: str


allowed_user_roles = ("company-admin", "startup-member", "reviewer")


def to_response(*, evaluation: Evaluation) -> dict[str, object]:
    payload = EvaluationSubmittedPayload.from_evaluation(evaluation=evaluation)
    return payload.model_dump(by_alias=True)


def read_actor(
    *,
    user_id: str,
    organization_id: str,
    role: str,
) -> ActorContext:
    if role not in allowed_user_roles:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid-role")

    return ActorContext(
        user_id=user_id,
        organization_id=organization_id,
        role=cast(UserRole, role),
    )


app = FastAPI(title="Sparkflow Evaluation Service")


@app.on_event("startup")
async def startup() -> None:
    database_url = os.getenv(
        "DATABASE_URL",
        "postgres://sparkflow:sparkflow@localhost:5432/sparkflow_evaluation",
    )
    nats_url = os.getenv("NATS_URL", "nats://localhost:4222")
    pool = await asyncpg.create_pool(database_url)

    if pool is None:
        raise RuntimeError("Unable to create PostgreSQL pool")

    await ensure_evaluation_schema(pool=pool)
    event_publisher = await create_nats_event_publisher(nats_url=nats_url)

    app.state.submit_evaluation_use_case = SubmitEvaluationUseCase(
        evaluation_repository=PostgresEvaluationRepository(pool=pool),
        event_publisher=event_publisher,
    )


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/submissions/{submission_id}/evaluations")
async def submit_evaluation(
    submission_id: str,
    body: SubmitEvaluationRequest,
    response: Response,
    x_user_id: Annotated[str, Header()] = "anonymous",
    x_organization_id: Annotated[str, Header()] = "unknown-organization",
    x_role: Annotated[str, Header()] = "startup-member",
    x_correlation_id: Annotated[str, Header()] = "missing-correlation-id",
) -> dict[str, object]:
    actor = read_actor(user_id=x_user_id, organization_id=x_organization_id, role=x_role)
    use_case: SubmitEvaluationUseCase = app.state.submit_evaluation_use_case
    result = await use_case.execute(
        command=SubmitEvaluationCommand(
            actor=actor,
            submission_id=submission_id,
            score=body.score,
            comment=body.comment,
            correlation_id=x_correlation_id,
        )
    )

    if isinstance(result, Failure):
        if result.error == "forbidden":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=result.error)

        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result.error)

    if isinstance(result, Success):
        response.status_code = status.HTTP_201_CREATED
        return to_response(evaluation=result.value)

    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

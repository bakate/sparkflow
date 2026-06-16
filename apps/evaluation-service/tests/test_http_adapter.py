from dataclasses import dataclass, field
from datetime import UTC, datetime

from fastapi.testclient import TestClient

from application.result import Failure, Result, Success
from application.submit_evaluation_use_case import (
    SubmitEvaluationCommand,
    SubmitEvaluationError,
)
from domain.evaluation import Evaluation
from infrastructure.contracts import ActorContext
from main import app


@dataclass(slots=True)
class RecordingSubmitEvaluationUseCase:
    result: Result[SubmitEvaluationError, Evaluation]
    commands: list[SubmitEvaluationCommand] = field(default_factory=list)

    async def execute(
        self,
        *,
        command: SubmitEvaluationCommand,
    ) -> Result[SubmitEvaluationError, Evaluation]:
        self.commands.append(command)
        return self.result


def create_evaluation() -> Evaluation:
    return Evaluation(
        id="evaluation-1",
        submission_id="submission-1",
        reviewer_id="user-reviewer",
        score=91,
        recommendation="strong-fit",
        comment="Strong strategic fit.",
        created_at=datetime(2026, 6, 16, 10, 0, 0, tzinfo=UTC),
    )


def create_client(*, use_case: RecordingSubmitEvaluationUseCase | None = None) -> TestClient:
    app.state.submit_evaluation_use_case = use_case or RecordingSubmitEvaluationUseCase(
        result=Success(value=create_evaluation())
    )

    return TestClient(app)


def read_recorded_command(
    *,
    commands: list[SubmitEvaluationCommand],
) -> SubmitEvaluationCommand:
    command = commands[0] if len(commands) > 0 else None

    if command is None:
        raise AssertionError("Missing recorded command")

    return command


def test_health_does_not_call_submit_evaluation_use_case() -> None:
    use_case = RecordingSubmitEvaluationUseCase(result=Success(value=create_evaluation()))
    client = create_client(use_case=use_case)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert use_case.commands == []


def test_submit_evaluation_maps_http_request_to_use_case_command() -> None:
    use_case = RecordingSubmitEvaluationUseCase(result=Success(value=create_evaluation()))
    client = create_client(use_case=use_case)

    response = client.post(
        "/submissions/submission-1/evaluations",
        headers={
            "x-user-id": "user-reviewer",
            "x-organization-id": "org-reviewer",
            "x-role": "reviewer",
            "x-correlation-id": "correlation-1",
        },
        json={
            "score": 91,
            "comment": "Strong strategic fit.",
        },
    )

    command = read_recorded_command(commands=use_case.commands)

    assert response.status_code == 201
    assert response.json() == {
        "id": "evaluation-1",
        "submissionId": "submission-1",
        "reviewerId": "user-reviewer",
        "score": 91,
        "recommendation": "strong-fit",
        "comment": "Strong strategic fit.",
        "createdAt": "2026-06-16T10:00:00+00:00",
    }
    assert command == SubmitEvaluationCommand(
        actor=ActorContext(
            user_id="user-reviewer",
            organization_id="org-reviewer",
            role="reviewer",
        ),
        submission_id="submission-1",
        score=91,
        comment="Strong strategic fit.",
        correlation_id="correlation-1",
    )


def test_submit_evaluation_maps_forbidden_failure_to_403() -> None:
    use_case = RecordingSubmitEvaluationUseCase(result=Failure(error="forbidden"))
    client = create_client(use_case=use_case)

    response = client.post(
        "/submissions/submission-1/evaluations",
        headers={
            "x-role": "company-admin",
        },
        json={
            "score": 91,
            "comment": "Strong strategic fit.",
        },
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "forbidden"}


def test_submit_evaluation_rejects_invalid_roles_before_calling_use_case() -> None:
    use_case = RecordingSubmitEvaluationUseCase(result=Success(value=create_evaluation()))
    client = create_client(use_case=use_case)

    response = client.post(
        "/submissions/submission-1/evaluations",
        headers={
            "x-role": "invalid-role",
        },
        json={
            "score": 91,
            "comment": "Strong strategic fit.",
        },
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "invalid-role"}
    assert use_case.commands == []


def test_submit_evaluation_rejects_invalid_payload_before_calling_use_case() -> None:
    use_case = RecordingSubmitEvaluationUseCase(result=Success(value=create_evaluation()))
    client = create_client(use_case=use_case)

    response = client.post(
        "/submissions/submission-1/evaluations",
        headers={
            "x-role": "reviewer",
        },
        json={
            "score": 101,
            "comment": "Strong strategic fit.",
        },
    )

    assert response.status_code == 422
    assert use_case.commands == []

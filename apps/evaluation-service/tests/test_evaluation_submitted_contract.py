import json
from pathlib import Path

from infrastructure.contracts import DomainEvent, EvaluationSubmittedPayload

fixture_path = (
    Path(__file__).parents[3]
    / "packages"
    / "contracts"
    / "fixtures"
    / "evaluation-submitted-event.json"
)


def test_evaluation_submitted_fixture_matches_python_contracts() -> None:
    event_data = json.loads(fixture_path.read_text())

    event = DomainEvent.model_validate(event_data)
    payload = EvaluationSubmittedPayload.model_validate(event_data["payload"])

    assert event.eventName == "evaluation.submitted"
    assert event.producer == "evaluation-service"
    assert payload.submission_id == "submission-2b6c2fed-89d4-4f9b-9cbf-c6d5da96af58"
    assert payload.reviewer_id == "user-reviewer"
    assert payload.recommendation == "strong-fit"
    assert payload.model_dump(by_alias=True) == event_data["payload"]

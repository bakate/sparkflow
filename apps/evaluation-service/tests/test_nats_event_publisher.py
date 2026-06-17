import os

import nats
import pytest
from faker import Faker
from nats.aio.client import Client

from infrastructure.contracts import DomainEvent, EvaluationSubmittedPayload
from infrastructure.nats_event_publisher import NatsEventPublisher, create_nats_event_publisher

test_nats_url = os.getenv("EVALUATION_SERVICE_TEST_NATS_URL")
should_run_integration_tests = test_nats_url is not None and len(test_nats_url.strip()) > 0
faker = Faker()


def require_test_nats_url() -> str:
    if test_nats_url is None or len(test_nats_url.strip()) == 0:
        pytest.fail("EVALUATION_SERVICE_TEST_NATS_URL is required")

    return test_nats_url


def create_evaluation_submitted_event() -> DomainEvent:
    return DomainEvent(
        eventId=faker.uuid4(),
        eventName="evaluation.submitted",
        occurredAt="2026-06-16T10:00:00+00:00",
        correlationId=faker.uuid4(),
        producer="evaluation-service",
        payload=EvaluationSubmittedPayload(
            id=faker.uuid4(),
            submission_id=faker.uuid4(),
            reviewer_id=faker.uuid4(),
            score=91,
            recommendation="strong-fit",
            comment=faker.sentence(),
            created_at="2026-06-16T10:00:00+00:00",
        ),
    )


@pytest.mark.skipif(
    not should_run_integration_tests,
    reason="EVALUATION_SERVICE_TEST_NATS_URL is required",
)
async def test_publishes_evaluation_submitted_to_jetstream() -> None:
    nats_url = require_test_nats_url()
    event = create_evaluation_submitted_event()
    publisher: NatsEventPublisher | None = None
    connection: Client | None = None

    try:
        publisher = await create_nats_event_publisher(nats_url=nats_url)
        await publisher.publish(event=event)

        connection = await nats.connect(nats_url)
        jetstream = connection.jetstream()
        stored_message = await jetstream.get_msg(
            stream_name="SPARKFLOW_EVENTS",
            subject=event.eventName,
        )

        if stored_message.data is None:
            pytest.fail("Expected stored NATS message data")

        assert stored_message.data.decode("utf-8") == event.model_dump_json(by_alias=True)
    finally:
        if connection is not None:
            await connection.drain()

        if publisher is not None:
            await publisher.close()

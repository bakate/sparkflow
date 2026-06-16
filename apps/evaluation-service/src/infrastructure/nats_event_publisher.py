import nats

from src.infrastructure.contracts import DomainEvent


class NatsEventPublisher:
    def __init__(self, *, jetstream: nats.js.JetStreamContext) -> None:
        self._jetstream = jetstream

    async def publish(self, *, event: DomainEvent) -> None:
        payload = event.model_dump_json(by_alias=True).encode("utf-8")
        await self._jetstream.publish(event.eventName, payload)


async def create_nats_event_publisher(*, nats_url: str) -> NatsEventPublisher:
    connection = await nats.connect(nats_url)
    jetstream = connection.jetstream()

    try:
        await jetstream.add_stream(
            name="SPARKFLOW_EVENTS",
            subjects=["challenge.*", "submission.*", "evaluation.*", "notification.*"],
        )
    except Exception:
        await jetstream.stream_info("SPARKFLOW_EVENTS")

    return NatsEventPublisher(jetstream=jetstream)

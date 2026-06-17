import nats
from nats.aio.client import Client

from infrastructure.contracts import DomainEvent


class NatsEventPublisher:
    def __init__(self, *, connection: Client, jetstream: nats.js.JetStreamContext) -> None:
        self._connection = connection
        self._jetstream = jetstream

    async def close(self) -> None:
        await self._connection.drain()

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

    return NatsEventPublisher(connection=connection, jetstream=jetstream)

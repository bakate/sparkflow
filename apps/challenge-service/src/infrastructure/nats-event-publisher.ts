import type { DomainEvent } from "@sparkflow/contracts";
import { connect, JSONCodec, type JetStreamClient } from "nats";
import type { EventPublisher } from "../application/ports.ts";

const jsonCodec = JSONCodec<DomainEvent>();

export const createNatsEventPublisher = async (input: {
  readonly natsUrl: string;
}): Promise<EventPublisher> => {
  const connection = await connect({ servers: input.natsUrl });
  const jetStreamManager = await connection.jetstreamManager();

  try {
    await jetStreamManager.streams.add({
      name: "SPARKFLOW_EVENTS",
      subjects: ["challenge.*", "submission.*", "evaluation.*", "notification.*"],
    });
  } catch {
    await jetStreamManager.streams.info("SPARKFLOW_EVENTS");
  }

  const jetStream: JetStreamClient = connection.jetstream();

  return {
    publish: async ({ event }) => {
      await jetStream.publish(event.eventName, jsonCodec.encode(event));
    },
  };
};

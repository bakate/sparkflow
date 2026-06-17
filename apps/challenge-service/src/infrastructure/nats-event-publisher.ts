import type { ChallengeDto, DomainEvent } from "@sparkflow/contracts";
import { connect, JSONCodec, type JetStreamClient } from "nats";
import type { EventPublisher } from "../application/ports.ts";

const jsonCodec = JSONCodec<DomainEvent>();

export type NatsEventPublisher = EventPublisher & {
  readonly close: () => Promise<void>;
};

export const createNatsEventPublisher = async (input: {
  readonly natsUrl: string;
}): Promise<NatsEventPublisher> => {
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
    close: async () => {
      await connection.drain();
    },
    publish: async ({ event }: { readonly event: DomainEvent<ChallengeDto> }) => {
      await jetStream.publish(event.eventName, jsonCodec.encode(event));
    },
  };
};

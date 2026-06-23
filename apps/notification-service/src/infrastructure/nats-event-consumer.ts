import { logger } from "@sparkflow/logger";
import { eventNames, type DomainEvent } from "@sparkflow/contracts";
import {
  AckPolicy,
  connect,
  DeliverPolicy,
  JSONCodec,
  type ConsumerMessages,
  type NatsConnection,
} from "nats";
import type { CreateNotificationFromEventUseCase } from "../application/create-notification-from-event.use-case.ts";

const jsonCodec = JSONCodec<DomainEvent>();
const streamName = "SPARKFLOW_EVENTS";
const defaultConsumerName = "notification-service";
const consumedEventNames = [
  eventNames.submissionCreated,
  eventNames.evaluationSubmitted,
  eventNames.submissionAccepted,
  eventNames.submissionRejected,
  eventNames.submissionSelected,
] as const;

export type NatsEventConsumer = {
  readonly close: () => Promise<void>;
};

const ensureStream = async (input: { readonly connection: NatsConnection }): Promise<void> => {
  const jetStreamManager = await input.connection.jetstreamManager();

  try {
    await jetStreamManager.streams.add({
      name: streamName,
      subjects: ["challenge.*", "submission.*", "evaluation.*", "notification.*"],
    });
  } catch {
    await jetStreamManager.streams.info(streamName);
  }
};

const ensureConsumer = async (input: {
  readonly connection: NatsConnection;
  readonly consumerName: string;
}): Promise<void> => {
  const jetStreamManager = await input.connection.jetstreamManager();

  try {
    await jetStreamManager.consumers.add(streamName, {
      durable_name: input.consumerName,
      name: input.consumerName,
      ack_policy: AckPolicy.Explicit,
      deliver_policy: DeliverPolicy.All,
      filter_subjects: [...consumedEventNames],
      max_ack_pending: 32,
    });
  } catch {
    await jetStreamManager.consumers.info(streamName, input.consumerName);
  }
};

const consumeMessages = async (input: {
  readonly messages: ConsumerMessages;
  readonly createNotificationFromEventUseCase: CreateNotificationFromEventUseCase;
}): Promise<void> => {
  for await (const message of input.messages) {
    try {
      const event = jsonCodec.decode(message.data);
      const notification = await input.createNotificationFromEventUseCase.execute({ event });

      if (notification !== null) {
        logger.info("notification created", { notificationId: notification.id });
      }

      message.ack();
    } catch (error) {
      logger.error("failed to process NATS event", { error });
      message.nak();
    }
  }
};

export const startNatsEventConsumer = async (input: {
  readonly natsUrl: string;
  readonly createNotificationFromEventUseCase: CreateNotificationFromEventUseCase;
  readonly consumerName?: string;
}): Promise<NatsEventConsumer> => {
  const connection = await connect({ servers: input.natsUrl });
  const consumerName = input.consumerName ?? defaultConsumerName;

  await ensureStream({ connection });
  await ensureConsumer({ connection, consumerName });

  const jetStream = connection.jetstream();
  const consumer = await jetStream.consumers.get(streamName, consumerName);
  const messages = await consumer.consume();

  void consumeMessages({
    messages,
    createNotificationFromEventUseCase: input.createNotificationFromEventUseCase,
  });

  return {
    close: async () => {
      await messages.close();
      await connection.drain();
    },
  };
};

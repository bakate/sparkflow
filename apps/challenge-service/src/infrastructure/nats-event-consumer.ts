import { eventNames, type DomainEvent, type SubmissionDto } from "@sparkflow/contracts";
import { logger } from "@sparkflow/logger";
import {
  AckPolicy,
  connect,
  DeliverPolicy,
  JSONCodec,
  type ConsumerMessages,
  type NatsConnection,
} from "nats";
import type { CompleteSelectionUseCase } from "../application/complete-selection.use-case.ts";

const jsonCodec = JSONCodec<DomainEvent>();
const streamName = "SPARKFLOW_EVENTS";
const defaultConsumerName = "challenge-service";
const consumedEventNames = [eventNames.submissionSelected] as const;

const createConsumerConfig = (input: { readonly consumerName: string }) => ({
  durable_name: input.consumerName,
  name: input.consumerName,
  ack_policy: AckPolicy.Explicit,
  deliver_policy: DeliverPolicy.All,
  filter_subjects: [...consumedEventNames],
  max_ack_pending: 32,
});

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
  const consumerConfig = createConsumerConfig({ consumerName: input.consumerName });

  try {
    await jetStreamManager.consumers.add(streamName, consumerConfig);
  } catch {
    const consumerInfo = await jetStreamManager.consumers.info(streamName, input.consumerName);

    if (!hasExpectedFilterSubjects({ actualSubjects: consumerInfo.config.filter_subjects })) {
      await jetStreamManager.consumers.update(streamName, input.consumerName, consumerConfig);
    }
  }
};

const hasExpectedFilterSubjects = (input: {
  readonly actualSubjects: readonly string[] | undefined;
}): boolean => {
  if (input.actualSubjects === undefined) {
    return false;
  }

  const expectedSubjects = [...consumedEventNames].sort();
  const actualSubjects = [...input.actualSubjects].sort();

  if (actualSubjects.length !== expectedSubjects.length) {
    return false;
  }

  return actualSubjects.every(
    (actualSubject, subjectIndex) => actualSubject === expectedSubjects[subjectIndex],
  );
};

const isSubmissionSelectedEvent = (event: DomainEvent): event is DomainEvent<SubmissionDto> =>
  event.eventName === eventNames.submissionSelected &&
  typeof event.payload === "object" &&
  event.payload !== null &&
  "challengeId" in event.payload;

const consumeMessages = async (input: {
  readonly messages: ConsumerMessages;
  readonly completeSelectionUseCase: CompleteSelectionUseCase;
}): Promise<void> => {
  for await (const message of input.messages) {
    try {
      const event = jsonCodec.decode(message.data);

      if (isSubmissionSelectedEvent(event)) {
        const completedChallenge = await input.completeSelectionUseCase.execute({
          challengeId: event.payload.challengeId,
        });

        if (completedChallenge !== null) {
          logger.info("challenge selection completed", { challengeId: completedChallenge.id });
        }
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
  readonly completeSelectionUseCase: CompleteSelectionUseCase;
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
    completeSelectionUseCase: input.completeSelectionUseCase,
  });

  return {
    close: async () => {
      await messages.close();
      await connection.drain();
    },
  };
};

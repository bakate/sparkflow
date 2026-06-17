import { faker } from "@faker-js/faker";
import { eventNames, type DomainEvent, type SubmissionDto } from "@sparkflow/contracts";
import { connect, JSONCodec } from "nats";
import { afterEach, describe, expect, it } from "vitest";
import type { CreateNotificationFromEventUseCase } from "../application/create-notification-from-event.use-case.ts";
import { startNatsEventConsumer, type NatsEventConsumer } from "./nats-event-consumer.ts";

const testNatsUrl = process.env.NOTIFICATION_SERVICE_TEST_NATS_URL;
const shouldRunIntegrationTests = testNatsUrl !== undefined && testNatsUrl.trim().length > 0;
const jsonCodec = JSONCodec<DomainEvent<SubmissionDto>>();
const streamName = "SPARKFLOW_EVENTS";

const requireTestNatsUrl = (): string => {
  if (testNatsUrl === undefined || testNatsUrl.trim().length === 0) {
    expect.fail("NOTIFICATION_SERVICE_TEST_NATS_URL is required for integration tests");
  }

  return testNatsUrl;
};

const createSubmissionCreatedEvent = (): DomainEvent<SubmissionDto> => ({
  eventId: faker.string.uuid(),
  eventName: eventNames.submissionCreated,
  occurredAt: "2026-06-16T10:00:00.000Z",
  correlationId: faker.string.uuid(),
  producer: "submission-service",
  payload: {
    id: faker.string.uuid(),
    challengeId: faker.string.uuid(),
    startupOrganizationId: faker.string.uuid(),
    summary: faker.company.catchPhrase(),
    status: "submitted",
    createdAt: "2026-06-16T10:00:00.000Z",
    decidedAt: null,
  },
});

const createConsumerName = (): string =>
  `notification-service-${faker.string.alphanumeric({ casing: "lower", length: 12 })}`;

const waitWithTimeout = async <ResolvedValue>(input: {
  readonly promise: Promise<ResolvedValue>;
  readonly timeoutInMilliseconds: number;
  readonly timeoutMessage: string;
}): Promise<ResolvedValue> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(input.timeoutMessage));
    }, input.timeoutInMilliseconds);
  });

  try {
    return await Promise.race([input.promise, timeoutPromise]);
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
};

const createRecordingUseCase = (input: {
  readonly targetEventId: string;
}): {
  readonly useCase: CreateNotificationFromEventUseCase;
  readonly waitForEvent: () => Promise<DomainEvent>;
} => {
  let resolveMatchingEvent: ((event: DomainEvent) => void) | null = null;
  const matchingEventPromise = new Promise<DomainEvent>((resolve) => {
    resolveMatchingEvent = resolve;
  });

  return {
    useCase: {
      execute: async ({ event }) => {
        if (event.eventId === input.targetEventId && resolveMatchingEvent !== null) {
          resolveMatchingEvent(event);
        }

        return null;
      },
    },
    waitForEvent: async () =>
      waitWithTimeout({
        promise: matchingEventPromise,
        timeoutInMilliseconds: 5_000,
        timeoutMessage: "Timed out waiting for notification-service NATS consumer",
      }),
  };
};

describe.skipIf(!shouldRunIntegrationTests)("NatsEventConsumer integration", () => {
  let consumer: NatsEventConsumer | null = null;
  let createdConsumerName: string | null = null;

  afterEach(async () => {
    const natsUrl = requireTestNatsUrl();

    if (consumer !== null) {
      await consumer.close();
      consumer = null;
    }

    if (createdConsumerName !== null) {
      const connection = await connect({ servers: natsUrl });
      const jetStreamManager = await connection.jetstreamManager();

      try {
        await jetStreamManager.consumers.delete(streamName, createdConsumerName);
      } catch {
        await jetStreamManager.consumers.info(streamName, createdConsumerName);
      } finally {
        await connection.drain();
        createdConsumerName = null;
      }
    }
  });

  it("consumes a stored submission.created event from JetStream", async () => {
    const natsUrl = requireTestNatsUrl();
    const event = createSubmissionCreatedEvent();
    const recordingUseCase = createRecordingUseCase({ targetEventId: event.eventId });
    createdConsumerName = createConsumerName();
    consumer = await startNatsEventConsumer({
      natsUrl,
      consumerName: createdConsumerName,
      createNotificationFromEventUseCase: recordingUseCase.useCase,
    });

    const connection = await connect({ servers: natsUrl });
    const jetStream = connection.jetstream();

    try {
      await jetStream.publish(event.eventName, jsonCodec.encode(event));

      await expect(recordingUseCase.waitForEvent()).resolves.toEqual(event);
    } finally {
      await connection.drain();
    }
  });
});

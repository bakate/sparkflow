import { faker } from "@faker-js/faker";
import { eventNames, type DomainEvent, type SubmissionDto } from "@sparkflow/contracts";
import { connect, JSONCodec } from "nats";
import { afterEach, describe, expect, it } from "vitest";
import { createNatsEventPublisher, type NatsEventPublisher } from "./nats-event-publisher.ts";

const testNatsUrl = process.env.SUBMISSION_SERVICE_TEST_NATS_URL;
const shouldRunIntegrationTests = testNatsUrl !== undefined && testNatsUrl.trim().length > 0;
const jsonCodec = JSONCodec<DomainEvent<SubmissionDto>>();

const requireTestNatsUrl = (): string => {
  if (testNatsUrl === undefined || testNatsUrl.trim().length === 0) {
    expect.fail("SUBMISSION_SERVICE_TEST_NATS_URL is required for integration tests");
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

describe.skipIf(!shouldRunIntegrationTests)("NatsEventPublisher integration", () => {
  let publisher: NatsEventPublisher | null = null;

  afterEach(async () => {
    if (publisher !== null) {
      await publisher.close();
      publisher = null;
    }
  });

  it("publishes submission.created to JetStream", async () => {
    const natsUrl = requireTestNatsUrl();
    const event = createSubmissionCreatedEvent();
    publisher = await createNatsEventPublisher({ natsUrl });

    await publisher.publish({ event });

    const connection = await connect({ servers: natsUrl });
    const jetStreamManager = await connection.jetstreamManager();

    try {
      const storedMessage = await jetStreamManager.streams.getMessage("SPARKFLOW_EVENTS", {
        last_by_subj: event.eventName,
      });
      const decodedEvent = jsonCodec.decode(storedMessage.data);

      expect(decodedEvent).toEqual(event);
    } finally {
      await connection.drain();
    }
  });
});

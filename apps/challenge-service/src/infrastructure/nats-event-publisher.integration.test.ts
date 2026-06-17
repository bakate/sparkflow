import { faker } from "@faker-js/faker";
import { eventNames, type ChallengeDto, type DomainEvent } from "@sparkflow/contracts";
import { connect, JSONCodec } from "nats";
import { afterEach, describe, expect, it } from "vitest";
import { createNatsEventPublisher, type NatsEventPublisher } from "./nats-event-publisher.ts";

const testNatsUrl = process.env.CHALLENGE_SERVICE_TEST_NATS_URL;
const shouldRunIntegrationTests = testNatsUrl !== undefined && testNatsUrl.trim().length > 0;
const jsonCodec = JSONCodec<DomainEvent<ChallengeDto>>();

const requireTestNatsUrl = (): string => {
  if (testNatsUrl === undefined || testNatsUrl.trim().length === 0) {
    expect.fail("CHALLENGE_SERVICE_TEST_NATS_URL is required for integration tests");
  }

  return testNatsUrl;
};

const createChallengePublishedEvent = (): DomainEvent<ChallengeDto> => {
  const challengeId = faker.string.uuid();
  const organizationId = faker.string.uuid();

  return {
    eventId: faker.string.uuid(),
    eventName: eventNames.challengePublished,
    occurredAt: "2026-06-16T10:00:00.000Z",
    correlationId: faker.string.uuid(),
    producer: "challenge-service",
    payload: {
      id: challengeId,
      title: faker.company.catchPhrase(),
      description: faker.lorem.sentence(),
      ownerOrganizationId: organizationId,
      status: "published",
      createdAt: "2026-06-16T09:00:00.000Z",
      publishedAt: "2026-06-16T10:00:00.000Z",
    },
  };
};

describe.skipIf(!shouldRunIntegrationTests)("NatsEventPublisher integration", () => {
  let publisher: NatsEventPublisher | null = null;

  afterEach(async () => {
    if (publisher !== null) {
      await publisher.close();
      publisher = null;
    }
  });

  it("publishes challenge.published to JetStream", async () => {
    const natsUrl = requireTestNatsUrl();
    const event = createChallengePublishedEvent();
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

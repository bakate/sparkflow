import { eventNames, type ChallengeDto, type DomainEvent } from "@sparkflow/contracts";
import { companyAdminActor, startupMemberActor } from "@sparkflow/testing";
import { describe, expect, it } from "vitest";
import type { Challenge } from "../domain/challenge.ts";
import { createPublishChallengeUseCase } from "./publish-challenge.use-case.ts";
import type { ChallengeRepository, Clock, EventPublisher, IdGenerator } from "./ports.ts";

const fixedCreatedAt = new Date("2026-06-16T09:00:00.000Z");
const fixedPublishedAt = new Date("2026-06-16T10:00:00.000Z");

const draftChallenge: Challenge = {
  id: "2b6c2fed-89d4-4f9b-9cbf-c6d5da96af58",
  title: "Circular packaging scouting",
  description: "Find startups for packaging waste reduction.",
  ownerOrganizationId: companyAdminActor.organizationId,
  status: "draft",
  createdAt: fixedCreatedAt,
  publishedAt: null,
};

const createInMemoryChallengeRepository = (
  initialChallenges: readonly Challenge[],
): ChallengeRepository & {
  readonly challenges: Challenge[];
} => {
  const challenges = [...initialChallenges];

  return {
    challenges,
    save: async ({ challenge }) => {
      const challengeIndex = challenges.findIndex((candidate) => candidate.id === challenge.id);

      if (challengeIndex === -1) {
        challenges.push(challenge);
        return;
      }

      challenges[challengeIndex] = challenge;
    },
    findById: async ({ challengeId }) =>
      challenges.find((challenge) => challenge.id === challengeId) ?? null,
    findAll: async () => [...challenges],
  };
};

const createInMemoryEventPublisher = (): EventPublisher & {
  readonly events: DomainEvent<ChallengeDto>[];
} => {
  const events: DomainEvent<ChallengeDto>[] = [];

  return {
    events,
    publish: async ({ event }) => {
      events.push(event);
    },
  };
};

const fixedClock: Clock = {
  now: () => fixedPublishedAt,
};
const fixedIdGenerator: IdGenerator = {
  generate: () => "event-2b6c2fed-89d4-4f9b-9cbf-c6d5da96af58",
};

describe("PublishChallengeUseCase", () => {
  it("publishes a draft challenge and emits challenge.published", async () => {
    const challengeRepository = createInMemoryChallengeRepository([draftChallenge]);
    const eventPublisher = createInMemoryEventPublisher();
    const useCase = createPublishChallengeUseCase({
      challengeRepository,
      clock: fixedClock,
      eventPublisher,
      idGenerator: fixedIdGenerator,
    });

    const result = await useCase.execute({
      actor: companyAdminActor,
      challengeId: draftChallenge.id,
      correlationId: "correlation-id",
    });

    expect(result.ok).toBe(true);
    expect(challengeRepository.challenges[0]?.status).toBe("published");
    expect(eventPublisher.events).toHaveLength(1);
    expect(eventPublisher.events[0]).toMatchObject({
      eventId: "event-2b6c2fed-89d4-4f9b-9cbf-c6d5da96af58",
      eventName: eventNames.challengePublished,
      occurredAt: "2026-06-16T10:00:00.000Z",
      correlationId: "correlation-id",
      producer: "challenge-service",
      payload: {
        id: draftChallenge.id,
        status: "published",
        publishedAt: "2026-06-16T10:00:00.000Z",
      },
    });
  });

  it("rejects publishing a missing challenge", async () => {
    const useCase = createPublishChallengeUseCase({
      challengeRepository: createInMemoryChallengeRepository([]),
      clock: fixedClock,
      eventPublisher: createInMemoryEventPublisher(),
      idGenerator: fixedIdGenerator,
    });

    const result = await useCase.execute({
      actor: companyAdminActor,
      challengeId: draftChallenge.id,
      correlationId: "correlation-id",
    });

    expect(result).toEqual({ ok: false, error: "challenge-not-found" });
  });

  it("rejects publishing from another role", async () => {
    const eventPublisher = createInMemoryEventPublisher();
    const useCase = createPublishChallengeUseCase({
      challengeRepository: createInMemoryChallengeRepository([draftChallenge]),
      clock: fixedClock,
      eventPublisher,
      idGenerator: fixedIdGenerator,
    });

    const result = await useCase.execute({
      actor: startupMemberActor,
      challengeId: draftChallenge.id,
      correlationId: "correlation-id",
    });

    expect(result).toEqual({ ok: false, error: "forbidden" });
    expect(eventPublisher.events).toHaveLength(0);
  });
});

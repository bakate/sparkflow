import { faker } from "@faker-js/faker";
import { eventNames, type DomainEvent, type SubmissionDto } from "@sparkflow/contracts";
import { succeed } from "@sparkflow/result";
import { companyAdminActor, startupMemberActor } from "@sparkflow/testing";
import { describe, expect, it } from "vitest";
import type { Submission } from "../domain/submission.ts";
import { createCreateSubmissionUseCase } from "./create-submission.use-case.ts";
import type { Clock, EventPublisher, IdGenerator, SubmissionRepository } from "./ports.ts";

const createInMemorySubmissionRepository = (): SubmissionRepository & {
  readonly submissions: Submission[];
} => {
  const submissions: Submission[] = [];

  return {
    submissions,
    save: async ({ submission }) => {
      submissions.push(submission);
      return succeed(undefined);
    },
    saveMany: async ({ submissions: nextSubmissions }) => {
      submissions.push(...nextSubmissions);
      return succeed(undefined);
    },
    saveDecision: async ({ submissions: nextSubmissions }) => {
      submissions.push(...nextSubmissions);
      return succeed(undefined);
    },
    findById: async ({ submissionId }) =>
      submissions.find((submission) => submission.id === submissionId) ?? null,
    findByChallengeId: async ({ challengeId }) =>
      submissions.filter((submission) => submission.challengeId === challengeId),
    findByStartupOrganizationId: async ({ startupOrganizationId }) =>
      submissions.filter(
        (submission) => submission.startupOrganizationId === startupOrganizationId,
      ),
    findDecisionAuditsBySubmissionId: async () => [],
  };
};

const createInMemoryEventPublisher = (): EventPublisher & {
  readonly events: DomainEvent<SubmissionDto>[];
} => {
  const events: DomainEvent<SubmissionDto>[] = [];

  return {
    events,
    publish: async ({ event }) => {
      events.push(event);
    },
  };
};

const fixedCreatedAt = new Date("2026-06-16T10:00:00.000Z");
const fixedClock: Clock = {
  now: () => fixedCreatedAt,
};
const createSequentialIdGenerator = (): IdGenerator => {
  const ids = [
    "submission-2b6c2fed-89d4-4f9b-9cbf-c6d5da96af58",
    "event-2b6c2fed-89d4-4f9b-9cbf-c6d5da96af58",
  ];

  return {
    generate: () => ids.shift() ?? "fallback-id",
  };
};

describe("CreateSubmissionUseCase", () => {
  it("creates a submission for startup members", async () => {
    const submissionRepository = createInMemorySubmissionRepository();
    const eventPublisher = createInMemoryEventPublisher();
    const useCase = createCreateSubmissionUseCase({
      submissionRepository,
      clock: fixedClock,
      eventPublisher,
      idGenerator: createSequentialIdGenerator(),
    });
    const challengeId = faker.string.uuid();
    const summary = faker.company.catchPhrase();

    const result = await useCase.execute({
      actor: startupMemberActor,
      challengeId,
      summary,
      correlationId: "correlation-id",
    });

    expect(result.ok).toBe(true);
    expect(submissionRepository.submissions).toHaveLength(1);
    expect(eventPublisher.events).toHaveLength(1);

    if (result.ok) {
      expect(result.value).toMatchObject({
        id: "submission-2b6c2fed-89d4-4f9b-9cbf-c6d5da96af58",
        challengeId,
        startupOrganizationId: startupMemberActor.organizationId,
        summary,
        status: "submitted",
        createdAt: "2026-06-16T10:00:00.000Z",
        decidedAt: null,
      });
    }

    expect(eventPublisher.events[0]).toMatchObject({
      eventId: "event-2b6c2fed-89d4-4f9b-9cbf-c6d5da96af58",
      eventName: eventNames.submissionCreated,
      occurredAt: "2026-06-16T10:00:00.000Z",
      correlationId: "correlation-id",
      producer: "submission-service",
      payload: {
        challengeId,
        summary,
        status: "submitted",
      },
    });
  });

  it("rejects company admins", async () => {
    const useCase = createCreateSubmissionUseCase({
      submissionRepository: createInMemorySubmissionRepository(),
      clock: fixedClock,
      eventPublisher: createInMemoryEventPublisher(),
      idGenerator: createSequentialIdGenerator(),
    });

    const result = await useCase.execute({
      actor: companyAdminActor,
      challengeId: "f5f8f358-2fd4-4ef2-9720-91b9e96c8c64",
      summary: "Bio-based packaging solution.",
      correlationId: "correlation-id",
    });

    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("rejects empty summaries", async () => {
    const submissionRepository = createInMemorySubmissionRepository();
    const eventPublisher = createInMemoryEventPublisher();
    const useCase = createCreateSubmissionUseCase({
      submissionRepository,
      clock: fixedClock,
      eventPublisher,
      idGenerator: createSequentialIdGenerator(),
    });

    const result = await useCase.execute({
      actor: startupMemberActor,
      challengeId: faker.string.uuid(),
      summary: " ",
      correlationId: "correlation-id",
    });

    expect(result).toEqual({ ok: false, error: "submission-summary-required" });
    expect(submissionRepository.submissions).toHaveLength(0);
    expect(eventPublisher.events).toHaveLength(0);
  });
});

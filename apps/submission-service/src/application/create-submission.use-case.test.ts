import { companyAdminActor, startupMemberActor } from "@sparkflow/testing";
import { describe, expect, it } from "vitest";
import type { Submission } from "../domain/submission.ts";
import { createCreateSubmissionUseCase } from "./create-submission.use-case.ts";
import type { EventPublisher, SubmissionRepository } from "./ports.ts";

const createInMemorySubmissionRepository = (): SubmissionRepository & {
  readonly submissions: Submission[];
} => {
  const submissions: Submission[] = [];

  return {
    submissions,
    save: async ({ submission }) => {
      submissions.push(submission);
    },
    findById: async ({ submissionId }) =>
      submissions.find((submission) => submission.id === submissionId) ?? null,
    findByChallengeId: async ({ challengeId }) =>
      submissions.filter((submission) => submission.challengeId === challengeId),
  };
};

const createInMemoryEventPublisher = (): EventPublisher & {
  readonly eventCount: () => number;
} => {
  const events: unknown[] = [];

  return {
    publish: async ({ event }) => {
      events.push(event);
    },
    eventCount: () => events.length,
  };
};

describe("CreateSubmissionUseCase", () => {
  it("creates a submission for startup members", async () => {
    const submissionRepository = createInMemorySubmissionRepository();
    const eventPublisher = createInMemoryEventPublisher();
    const useCase = createCreateSubmissionUseCase({ submissionRepository, eventPublisher });

    const result = await useCase.execute({
      actor: startupMemberActor,
      challengeId: "f5f8f358-2fd4-4ef2-9720-91b9e96c8c64",
      summary: "Bio-based packaging solution.",
      correlationId: "correlation-id",
    });

    expect(result.ok).toBe(true);
    expect(submissionRepository.submissions).toHaveLength(1);
    expect(eventPublisher.eventCount()).toBe(1);
  });

  it("rejects company admins", async () => {
    const useCase = createCreateSubmissionUseCase({
      submissionRepository: createInMemorySubmissionRepository(),
      eventPublisher: createInMemoryEventPublisher(),
    });

    const result = await useCase.execute({
      actor: companyAdminActor,
      challengeId: "f5f8f358-2fd4-4ef2-9720-91b9e96c8c64",
      summary: "Bio-based packaging solution.",
      correlationId: "correlation-id",
    });

    expect(result).toEqual({ ok: false, error: "forbidden" });
  });
});

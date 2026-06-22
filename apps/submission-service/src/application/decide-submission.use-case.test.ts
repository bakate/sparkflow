import { faker } from "@faker-js/faker";
import { eventNames, type DomainEvent, type SubmissionDto } from "@sparkflow/contracts";
import { companyAdminActor, startupMemberActor } from "@sparkflow/testing";
import { describe, expect, it } from "vitest";
import type { Submission } from "../domain/submission.ts";
import { createDecideSubmissionUseCase } from "./decide-submission.use-case.ts";
import type { Clock, EventPublisher, IdGenerator, SubmissionRepository } from "./ports.ts";

const fixedCreatedAt = new Date("2026-06-16T09:00:00.000Z");
const fixedDecidedAt = new Date("2026-06-16T10:00:00.000Z");

const createSubmittedSubmission = (): Submission => ({
  id: faker.string.uuid(),
  challengeId: faker.string.uuid(),
  startupOrganizationId: startupMemberActor.organizationId,
  summary: faker.company.catchPhrase(),
  status: "submitted",
  createdAt: fixedCreatedAt,
  decidedAt: null,
});

const createInMemorySubmissionRepository = (
  initialSubmissions: readonly Submission[],
): SubmissionRepository & {
  readonly submissions: Submission[];
} => {
  const submissions = [...initialSubmissions];

  return {
    submissions,
    save: async ({ submission }) => {
      const submissionIndex = submissions.findIndex((candidate) => candidate.id === submission.id);

      if (submissionIndex === -1) {
        submissions.push(submission);
        return;
      }

      submissions[submissionIndex] = submission;
    },
    findById: async ({ submissionId }) =>
      submissions.find((submission) => submission.id === submissionId) ?? null,
    findByChallengeId: async ({ challengeId }) =>
      submissions.filter((submission) => submission.challengeId === challengeId),
    findByStartupOrganizationId: async ({ startupOrganizationId }) =>
      submissions.filter(
        (submission) => submission.startupOrganizationId === startupOrganizationId,
      ),
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

const fixedClock: Clock = {
  now: () => fixedDecidedAt,
};
const fixedIdGenerator: IdGenerator = {
  generate: () => "event-2b6c2fed-89d4-4f9b-9cbf-c6d5da96af58",
};

describe("DecideSubmissionUseCase", () => {
  it("accepts a submitted submission and emits submission.accepted", async () => {
    const submission = createSubmittedSubmission();
    const submissionRepository = createInMemorySubmissionRepository([submission]);
    const eventPublisher = createInMemoryEventPublisher();
    const useCase = createDecideSubmissionUseCase({
      submissionRepository,
      clock: fixedClock,
      eventPublisher,
      idGenerator: fixedIdGenerator,
    });

    const result = await useCase.execute({
      actor: companyAdminActor,
      submissionId: submission.id,
      decision: "accept",
      correlationId: "correlation-id",
    });

    expect(result.ok).toBe(true);
    expect(submissionRepository.submissions[0]?.status).toBe("accepted");
    expect(eventPublisher.events[0]).toMatchObject({
      eventName: eventNames.submissionAccepted,
      occurredAt: "2026-06-16T10:00:00.000Z",
      payload: {
        id: submission.id,
        status: "accepted",
        decidedAt: "2026-06-16T10:00:00.000Z",
      },
    });
  });

  it("rejects a submitted submission and emits submission.rejected", async () => {
    const submission = createSubmittedSubmission();
    const eventPublisher = createInMemoryEventPublisher();
    const useCase = createDecideSubmissionUseCase({
      submissionRepository: createInMemorySubmissionRepository([submission]),
      clock: fixedClock,
      eventPublisher,
      idGenerator: fixedIdGenerator,
    });

    const result = await useCase.execute({
      actor: companyAdminActor,
      submissionId: submission.id,
      decision: "reject",
      correlationId: "correlation-id",
    });

    expect(result.ok).toBe(true);
    expect(eventPublisher.events[0]?.eventName).toBe(eventNames.submissionRejected);
  });

  it("rejects decisions from non company admins", async () => {
    const submission = createSubmittedSubmission();
    const eventPublisher = createInMemoryEventPublisher();
    const useCase = createDecideSubmissionUseCase({
      submissionRepository: createInMemorySubmissionRepository([submission]),
      clock: fixedClock,
      eventPublisher,
      idGenerator: fixedIdGenerator,
    });

    const result = await useCase.execute({
      actor: startupMemberActor,
      submissionId: submission.id,
      decision: "accept",
      correlationId: "correlation-id",
    });

    expect(result).toEqual({ ok: false, error: "forbidden" });
    expect(eventPublisher.events).toHaveLength(0);
  });

  it("rejects decisions on already decided submissions", async () => {
    const submission = {
      ...createSubmittedSubmission(),
      status: "accepted",
      decidedAt: fixedDecidedAt,
    } satisfies Submission;
    const eventPublisher = createInMemoryEventPublisher();
    const useCase = createDecideSubmissionUseCase({
      submissionRepository: createInMemorySubmissionRepository([submission]),
      clock: fixedClock,
      eventPublisher,
      idGenerator: fixedIdGenerator,
    });

    const result = await useCase.execute({
      actor: companyAdminActor,
      submissionId: submission.id,
      decision: "reject",
      correlationId: "correlation-id",
    });

    expect(result).toEqual({ ok: false, error: "submission-already-decided" });
    expect(eventPublisher.events).toHaveLength(0);
  });
});

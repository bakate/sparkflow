import { faker } from "@faker-js/faker";
import { eventNames, type DomainEvent, type SubmissionDto } from "@sparkflow/contracts";
import { succeed } from "@sparkflow/result";
import { companyAdminActor, startupMemberActor } from "@sparkflow/testing";
import { describe, expect, it } from "vitest";
import type { Submission, SubmissionDecisionAudit } from "../domain/submission.ts";
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
  readonly audits: SubmissionDecisionAudit[];
} => {
  const submissions = [...initialSubmissions];
  const audits: SubmissionDecisionAudit[] = [];

  return {
    submissions,
    audits,
    save: async ({ submission }) => {
      const submissionIndex = submissions.findIndex((candidate) => candidate.id === submission.id);

      if (submissionIndex === -1) {
        submissions.push(submission);
        return succeed(undefined);
      }

      submissions[submissionIndex] = submission;
      return succeed(undefined);
    },
    saveMany: async ({ submissions: nextSubmissions }) => {
      for (const submission of nextSubmissions) {
        const submissionIndex = submissions.findIndex(
          (candidate) => candidate.id === submission.id,
        );

        if (submissionIndex === -1) {
          submissions.push(submission);
          continue;
        }

        submissions[submissionIndex] = submission;
      }

      return succeed(undefined);
    },
    saveDecision: async ({ submissions: nextSubmissions, audits: nextAudits }) => {
      for (const submission of nextSubmissions) {
        const submissionIndex = submissions.findIndex(
          (candidate) => candidate.id === submission.id,
        );

        if (submissionIndex === -1) {
          submissions.push(submission);
          continue;
        }

        submissions[submissionIndex] = submission;
      }

      audits.push(...nextAudits);
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
    findDecisionAuditsBySubmissionId: async ({ submissionId }) =>
      audits.filter((audit) => audit.submissionId === submissionId),
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
    expect(submissionRepository.audits[0]).toMatchObject({
      submissionId: submission.id,
      challengeId: submission.challengeId,
      decidedByUserId: companyAdminActor.userId,
      decidedByUserEmail: companyAdminActor.userEmail,
      decidedByOrganizationId: companyAdminActor.organizationId,
      decidedByRole: "company-admin",
      previousStatus: "submitted",
      newStatus: "accepted",
      decidedAt: fixedDecidedAt,
      reason: null,
    });
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
      decision: "reject",
      reason: "  Not aligned with the challenge scope.  ",
      correlationId: "correlation-id",
    });

    expect(result.ok).toBe(true);
    expect(submissionRepository.audits[0]?.reason).toBe("Not aligned with the challenge scope.");
    expect(eventPublisher.events[0]?.eventName).toBe(eventNames.submissionRejected);
  });

  it("selects a shortlisted submission and emits submission.selected", async () => {
    const submission: Submission = {
      ...createSubmittedSubmission(),
      status: "accepted",
      decidedAt: fixedDecidedAt,
    };
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
      decision: "select",
      correlationId: "correlation-id",
    });

    expect(result.ok).toBe(true);
    expect(submissionRepository.submissions[0]?.status).toBe("selected");
    expect(eventPublisher.events[0]).toMatchObject({
      eventName: eventNames.submissionSelected,
      occurredAt: "2026-06-16T10:00:00.000Z",
      payload: {
        id: submission.id,
        status: "selected",
        decidedAt: "2026-06-16T10:00:00.000Z",
      },
    });
  });

  it("marks other shortlisted submissions as not selected when selecting the final submission", async () => {
    const challengeId = faker.string.uuid();
    const selectedSubmission: Submission = {
      ...createSubmittedSubmission(),
      challengeId,
      status: "accepted",
      decidedAt: fixedDecidedAt,
    };
    const notSelectedSubmission: Submission = {
      ...createSubmittedSubmission(),
      challengeId,
      status: "accepted",
      decidedAt: fixedDecidedAt,
    };
    const pendingSubmission: Submission = {
      ...createSubmittedSubmission(),
      challengeId,
    };
    const rejectedSubmission: Submission = {
      ...createSubmittedSubmission(),
      challengeId,
      status: "rejected",
      decidedAt: fixedDecidedAt,
    };
    const submissionRepository = createInMemorySubmissionRepository([
      selectedSubmission,
      notSelectedSubmission,
      pendingSubmission,
      rejectedSubmission,
    ]);
    const eventPublisher = createInMemoryEventPublisher();
    const useCase = createDecideSubmissionUseCase({
      submissionRepository,
      clock: fixedClock,
      eventPublisher,
      idGenerator: fixedIdGenerator,
    });

    const result = await useCase.execute({
      actor: companyAdminActor,
      submissionId: selectedSubmission.id,
      decision: "select",
      correlationId: "correlation-id",
    });

    expect(result.ok).toBe(true);
    expect(
      submissionRepository.submissions.map((submission) => ({
        id: submission.id,
        status: submission.status,
      })),
    ).toEqual([
      { id: selectedSubmission.id, status: "selected" },
      { id: notSelectedSubmission.id, status: "not-selected" },
      { id: pendingSubmission.id, status: "submitted" },
      { id: rejectedSubmission.id, status: "rejected" },
    ]);
    expect(
      submissionRepository.audits.map((audit) => ({
        submissionId: audit.submissionId,
        previousStatus: audit.previousStatus,
        newStatus: audit.newStatus,
        decidedByUserId: audit.decidedByUserId,
      })),
    ).toEqual([
      {
        submissionId: selectedSubmission.id,
        previousStatus: "accepted",
        newStatus: "selected",
        decidedByUserId: companyAdminActor.userId,
      },
      {
        submissionId: notSelectedSubmission.id,
        previousStatus: "accepted",
        newStatus: "not-selected",
        decidedByUserId: companyAdminActor.userId,
      },
    ]);
    expect(eventPublisher.events).toHaveLength(1);
    expect(eventPublisher.events[0]?.eventName).toBe(eventNames.submissionSelected);
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

  it("rejects final selection before shortlisting", async () => {
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
      decision: "select",
      correlationId: "correlation-id",
    });

    expect(result).toEqual({ ok: false, error: "submission-not-shortlisted" });
    expect(eventPublisher.events).toHaveLength(0);
  });

  it("rejects final selection when another proposal is already selected", async () => {
    const challengeId = faker.string.uuid();
    const shortlistedSubmission: Submission = {
      ...createSubmittedSubmission(),
      challengeId,
      status: "accepted",
      decidedAt: fixedDecidedAt,
    };
    const selectedSubmission: Submission = {
      ...createSubmittedSubmission(),
      challengeId,
      status: "selected",
      decidedAt: fixedDecidedAt,
    };
    const eventPublisher = createInMemoryEventPublisher();
    const useCase = createDecideSubmissionUseCase({
      submissionRepository: createInMemorySubmissionRepository([
        shortlistedSubmission,
        selectedSubmission,
      ]),
      clock: fixedClock,
      eventPublisher,
      idGenerator: fixedIdGenerator,
    });

    const result = await useCase.execute({
      actor: companyAdminActor,
      submissionId: shortlistedSubmission.id,
      decision: "select",
      correlationId: "correlation-id",
    });

    expect(result).toEqual({ ok: false, error: "challenge-already-selected" });
    expect(eventPublisher.events).toHaveLength(0);
  });
});

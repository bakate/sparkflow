import { succeed } from "@sparkflow/result";
import { companyAdminActor, reviewerActor, startupMemberActor } from "@sparkflow/testing";
import { describe, expect, it } from "vitest";
import type { Submission, SubmissionDecisionAudit } from "../domain/submission.ts";
import { createListSubmissionDecisionAuditsUseCase } from "./list-submission-decision-audits.use-case.ts";
import type { SubmissionRepository } from "./ports.ts";

const fixedDecidedAt = new Date("2026-06-16T10:00:00.000Z");

const createInMemorySubmissionRepository = (input: {
  readonly audits: readonly SubmissionDecisionAudit[];
  readonly submissions?: readonly Submission[];
}): SubmissionRepository => ({
  save: async () => succeed(undefined),
  saveMany: async () => succeed(undefined),
  saveDecision: async () => succeed(undefined),
  findById: async ({ submissionId }) =>
    input.submissions?.find((submission) => submission.id === submissionId) ?? null,
  findByChallengeId: async () => [],
  findByStartupOrganizationId: async () => [],
  findDecisionAuditsBySubmissionId: async ({ submissionId }) =>
    input.audits.filter((audit) => audit.submissionId === submissionId),
});

describe("ListSubmissionDecisionAuditsUseCase", () => {
  it("lists decision audits for company admins", async () => {
    const audit = createAudit({ submissionId: "submission-1" });
    const useCase = createListSubmissionDecisionAuditsUseCase({
      submissionRepository: createInMemorySubmissionRepository({ audits: [audit] }),
    });

    const result = await useCase.execute({
      actor: companyAdminActor,
      submissionId: "submission-1",
    });

    expect(result).toEqual({
      ok: true,
      value: [
        {
          id: audit.id,
          submissionId: "submission-1",
          challengeId: audit.challengeId,
          decidedByUserId: companyAdminActor.userId,
          decidedByUserEmail: companyAdminActor.userEmail,
          decidedByOrganizationId: companyAdminActor.organizationId,
          decidedByRole: "company-admin",
          previousStatus: "submitted",
          newStatus: "accepted",
          decidedAt: "2026-06-16T10:00:00.000Z",
          reason: null,
        },
      ],
    });
  });

  it("lists decision audits for the startup that owns the submission", async () => {
    const submission = createSubmission({ submissionId: "submission-1" });
    const audit = createAudit({ submissionId: submission.id });
    const useCase = createListSubmissionDecisionAuditsUseCase({
      submissionRepository: createInMemorySubmissionRepository({
        audits: [audit],
        submissions: [submission],
      }),
    });

    const result = await useCase.execute({
      actor: startupMemberActor,
      submissionId: submission.id,
    });

    expect(result.ok).toBe(true);
    expect(result.ok ? result.value : []).toHaveLength(1);
  });

  it("rejects startup members for submissions owned by another organization", async () => {
    const useCase = createListSubmissionDecisionAuditsUseCase({
      submissionRepository: createInMemorySubmissionRepository({
        audits: [],
        submissions: [
          {
            ...createSubmission({ submissionId: "submission-1" }),
            startupOrganizationId: "org-other-startup",
          },
        ],
      }),
    });

    const result = await useCase.execute({
      actor: startupMemberActor,
      submissionId: "submission-1",
    });

    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("rejects reviewers", async () => {
    const useCase = createListSubmissionDecisionAuditsUseCase({
      submissionRepository: createInMemorySubmissionRepository({ audits: [] }),
    });

    const result = await useCase.execute({
      actor: reviewerActor,
      submissionId: "submission-1",
    });

    expect(result).toEqual({ ok: false, error: "forbidden" });
  });
});

const createAudit = (input: { readonly submissionId: string }): SubmissionDecisionAudit => {
  const submission = createSubmission({ submissionId: input.submissionId });

  return {
    id: "audit-1",
    submissionId: submission.id,
    challengeId: submission.challengeId,
    decidedByUserId: companyAdminActor.userId,
    decidedByUserEmail: companyAdminActor.userEmail ?? null,
    decidedByOrganizationId: companyAdminActor.organizationId,
    decidedByRole: companyAdminActor.role,
    previousStatus: "submitted",
    newStatus: "accepted",
    decidedAt: fixedDecidedAt,
    reason: null,
  };
};

const createSubmission = (input: { readonly submissionId: string }): Submission => ({
  id: input.submissionId,
  challengeId: "challenge-1",
  startupOrganizationId: "org-startup",
  summary: "A strong proposal",
  status: "submitted",
  createdAt: new Date("2026-06-16T09:00:00.000Z"),
  decidedAt: null,
});

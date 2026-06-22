import { companyAdminActor, startupMemberActor } from "@sparkflow/testing";
import { describe, expect, it } from "vitest";
import type { Submission } from "../domain/submission.ts";
import { createListMySubmissionsUseCase } from "./list-my-submissions.use-case.ts";
import type { SubmissionRepository } from "./ports.ts";

const createInMemorySubmissionRepository = (input: {
  readonly submissions: readonly Submission[];
}): SubmissionRepository => ({
  save: async () => undefined,
  findById: async ({ submissionId }) =>
    input.submissions.find((submission) => submission.id === submissionId) ?? null,
  findByChallengeId: async ({ challengeId }) =>
    input.submissions.filter((submission) => submission.challengeId === challengeId),
  findByStartupOrganizationId: async ({ startupOrganizationId }) =>
    input.submissions.filter(
      (submission) => submission.startupOrganizationId === startupOrganizationId,
    ),
});

describe("ListMySubmissionsUseCase", () => {
  it("lists submissions for the current startup organization", async () => {
    const ownSubmission = createSubmission({
      id: "submission-own",
      startupOrganizationId: startupMemberActor.organizationId,
    });
    const otherSubmission = createSubmission({
      id: "submission-other",
      startupOrganizationId: "org-other",
    });
    const useCase = createListMySubmissionsUseCase({
      submissionRepository: createInMemorySubmissionRepository({
        submissions: [ownSubmission, otherSubmission],
      }),
    });

    const result = await useCase.execute({ actor: startupMemberActor });

    expect(result).toEqual({
      ok: true,
      value: [
        {
          id: ownSubmission.id,
          challengeId: ownSubmission.challengeId,
          startupOrganizationId: ownSubmission.startupOrganizationId,
          summary: ownSubmission.summary,
          status: ownSubmission.status,
          createdAt: ownSubmission.createdAt.toISOString(),
          decidedAt: null,
        },
      ],
    });
  });

  it("rejects non startup actors", async () => {
    const useCase = createListMySubmissionsUseCase({
      submissionRepository: createInMemorySubmissionRepository({ submissions: [] }),
    });

    const result = await useCase.execute({ actor: companyAdminActor });

    expect(result).toEqual({ ok: false, error: "forbidden" });
  });
});

const createSubmission = (input: {
  readonly id: string;
  readonly startupOrganizationId: string;
}): Submission => ({
  id: input.id,
  challengeId: "challenge-1",
  startupOrganizationId: input.startupOrganizationId,
  summary: "A serious proposal.",
  status: "submitted",
  createdAt: new Date("2026-06-22T09:00:00.000Z"),
  decidedAt: null,
});

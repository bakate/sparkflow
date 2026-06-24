import { succeed } from "@sparkflow/result";
import { companyAdminActor, startupMemberActor } from "@sparkflow/testing";
import { describe, expect, it } from "vitest";
import type { Submission } from "../domain/submission.ts";
import { createListMySubmissionsUseCase } from "./list-my-submissions.use-case.ts";
import type { SubmissionRepository } from "./ports.ts";

const createInMemorySubmissionRepository = (input: {
  readonly submissions: readonly Submission[];
}): SubmissionRepository => ({
  save: async () => succeed(undefined),
  saveMany: async () => succeed(undefined),
  saveDecision: async () => succeed(undefined),
  findById: async ({ submissionId }) =>
    input.submissions.find((submission) => submission.id === submissionId) ?? null,
  findByChallengeId: async ({ challengeId }) =>
    input.submissions.filter((submission) => submission.challengeId === challengeId),
  findPageByChallengeId: async ({ challengeId, page }) =>
    toCursorPage({
      items: input.submissions.filter((submission) => submission.challengeId === challengeId),
      limit: page.limit,
      cursor: page.cursor,
    }),
  findByStartupOrganizationId: async ({ startupOrganizationId }) =>
    input.submissions.filter(
      (submission) => submission.startupOrganizationId === startupOrganizationId,
    ),
  findPageByStartupOrganizationId: async ({ startupOrganizationId, page }) =>
    toCursorPage({
      items: input.submissions.filter(
        (submission) => submission.startupOrganizationId === startupOrganizationId,
      ),
      limit: page.limit,
      cursor: page.cursor,
    }),
  findDecisionAuditsBySubmissionId: async () => [],
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

    const result = await useCase.execute({
      actor: startupMemberActor,
      page: { limit: 20, cursor: null },
    });

    expect(result).toEqual({
      ok: true,
      value: {
        items: [
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
        page: { limit: 20, nextCursor: null },
      },
    });
  });

  it("rejects non startup actors", async () => {
    const useCase = createListMySubmissionsUseCase({
      submissionRepository: createInMemorySubmissionRepository({ submissions: [] }),
    });

    const result = await useCase.execute({
      actor: companyAdminActor,
      page: { limit: 20, cursor: null },
    });

    expect(result).toEqual({ ok: false, error: "forbidden" });
  });
});

const toCursorPage = (input: {
  readonly items: readonly Submission[];
  readonly limit: number;
  readonly cursor: string | null;
}) => {
  const cursorIndex =
    input.cursor === null
      ? -1
      : input.items.findIndex((submission) => submission.id === input.cursor);
  const startIndex = cursorIndex + 1;
  const pageItems = input.items.slice(startIndex, startIndex + input.limit);
  const hasNextPage = input.items.length > startIndex + input.limit;
  const lastItem = pageItems.at(-1);

  return {
    items: pageItems,
    nextCursor: hasNextPage && lastItem !== undefined ? lastItem.id : null,
  };
};

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

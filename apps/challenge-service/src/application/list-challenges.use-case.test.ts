import type { ActorContext } from "@sparkflow/contracts";
import { describe, expect, it } from "vitest";
import type { Challenge } from "../domain/challenge.ts";
import { createListChallengesUseCase } from "./list-challenges.use-case.ts";
import type { ChallengeRepository } from "./ports.ts";

const companyAdminActor: ActorContext = {
  userId: "company-user",
  organizationId: "org-company-a",
  role: "company-admin",
};

const startupActor: ActorContext = {
  userId: "startup-user",
  organizationId: "org-startup",
  role: "startup-member",
};

describe("createListChallengesUseCase", () => {
  it("lists only the current company challenges for company admins", async () => {
    const ownDraftChallenge = createChallenge({
      id: "challenge-own-draft",
      ownerOrganizationId: companyAdminActor.organizationId,
      status: "draft",
    });
    const otherPublishedChallenge = createChallenge({
      id: "challenge-other-published",
      ownerOrganizationId: "org-company-b",
      status: "published",
    });
    const useCase = createListChallengesUseCase({
      challengeRepository: createChallengeRepository({
        challenges: [ownDraftChallenge, otherPublishedChallenge],
      }),
    });

    const challenges = await useCase.execute({ actor: companyAdminActor });

    expect(challenges.map((challenge) => challenge.id)).toEqual([ownDraftChallenge.id]);
  });

  it("lists only published challenges for startup members", async () => {
    const archivedChallenge = createChallenge({
      id: "challenge-archived",
      ownerOrganizationId: "org-company-a",
      status: "archived",
    });
    const completedChallenge = createChallenge({
      id: "challenge-completed",
      ownerOrganizationId: "org-company-a",
      status: "selection-completed",
    });
    const draftChallenge = createChallenge({
      id: "challenge-draft",
      ownerOrganizationId: "org-company-a",
      status: "draft",
    });
    const publishedChallenge = createChallenge({
      id: "challenge-published",
      ownerOrganizationId: "org-company-a",
      status: "published",
    });
    const useCase = createListChallengesUseCase({
      challengeRepository: createChallengeRepository({
        challenges: [archivedChallenge, completedChallenge, draftChallenge, publishedChallenge],
      }),
    });

    const challenges = await useCase.execute({ actor: startupActor });

    expect(challenges.map((challenge) => challenge.id)).toEqual([publishedChallenge.id]);
  });
});

const createChallengeRepository = (input: {
  readonly challenges: readonly Challenge[];
}): ChallengeRepository => ({
  save: async () => undefined,
  findById: async ({ challengeId }) =>
    input.challenges.find((challenge) => challenge.id === challengeId) ?? null,
  findAll: async () => input.challenges,
});

const createChallenge = (input: {
  readonly id: string;
  readonly ownerOrganizationId: string;
  readonly status: Challenge["status"];
}): Challenge => ({
  id: input.id,
  title: `Challenge ${input.id}`,
  description: `Description ${input.id}`,
  ownerOrganizationId: input.ownerOrganizationId,
  status: input.status,
  createdAt: new Date("2026-06-22T10:00:00.000Z"),
  publishedAt: input.status === "draft" ? null : new Date("2026-06-22T11:00:00.000Z"),
});

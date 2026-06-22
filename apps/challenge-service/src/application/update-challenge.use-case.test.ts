import { companyAdminActor, startupMemberActor } from "@sparkflow/testing";
import { describe, expect, it } from "vitest";
import type { Challenge } from "../domain/challenge.ts";
import type { ChallengeRepository } from "./ports.ts";
import { createUpdateChallengeUseCase } from "./update-challenge.use-case.ts";

const fixedCreatedAt = new Date("2026-06-16T09:00:00.000Z");

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

describe("UpdateChallengeUseCase", () => {
  it("updates challenge title and description for the owner company admin", async () => {
    const challengeRepository = createInMemoryChallengeRepository([draftChallenge]);
    const useCase = createUpdateChallengeUseCase({ challengeRepository });

    const result = await useCase.execute({
      actor: companyAdminActor,
      challengeId: draftChallenge.id,
      title: " Updated scouting ",
      description: " Updated description. ",
    });

    expect(result.ok).toBe(true);
    expect(challengeRepository.challenges[0]).toMatchObject({
      id: draftChallenge.id,
      title: "Updated scouting",
      description: "Updated description.",
      status: "draft",
      createdAt: fixedCreatedAt,
      publishedAt: null,
    });
  });

  it("rejects updating a missing challenge", async () => {
    const useCase = createUpdateChallengeUseCase({
      challengeRepository: createInMemoryChallengeRepository([]),
    });

    const result = await useCase.execute({
      actor: companyAdminActor,
      challengeId: draftChallenge.id,
      title: "Updated scouting",
      description: "Updated description.",
    });

    expect(result).toEqual({ ok: false, error: "challenge-not-found" });
  });

  it("rejects updating from another role", async () => {
    const challengeRepository = createInMemoryChallengeRepository([draftChallenge]);
    const useCase = createUpdateChallengeUseCase({ challengeRepository });

    const result = await useCase.execute({
      actor: startupMemberActor,
      challengeId: draftChallenge.id,
      title: "Updated scouting",
      description: "Updated description.",
    });

    expect(result).toEqual({ ok: false, error: "forbidden" });
    expect(challengeRepository.challenges[0]).toEqual(draftChallenge);
  });

  it("rejects empty titles", async () => {
    const challengeRepository = createInMemoryChallengeRepository([draftChallenge]);
    const useCase = createUpdateChallengeUseCase({ challengeRepository });

    const result = await useCase.execute({
      actor: companyAdminActor,
      challengeId: draftChallenge.id,
      title: " ",
      description: "Updated description.",
    });

    expect(result).toEqual({ ok: false, error: "challenge-title-required" });
    expect(challengeRepository.challenges[0]).toEqual(draftChallenge);
  });
});

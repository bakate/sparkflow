import { describe, expect, it } from "vitest";
import type { Challenge } from "../domain/challenge.ts";
import { createCompleteSelectionUseCase } from "./complete-selection.use-case.ts";
import type { ChallengeRepository } from "./ports.ts";

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
    findAll: async () => challenges,
  };
};

describe("CompleteSelectionUseCase", () => {
  it("marks a published challenge as selection completed", async () => {
    const challenge = createChallenge({ status: "published" });
    const challengeRepository = createInMemoryChallengeRepository([challenge]);
    const useCase = createCompleteSelectionUseCase({ challengeRepository });

    const result = await useCase.execute({ challengeId: challenge.id });

    expect(result).toMatchObject({
      id: challenge.id,
      status: "selection-completed",
    });
    expect(challengeRepository.challenges[0]?.status).toBe("selection-completed");
  });

  it("keeps selection completion idempotent", async () => {
    const challenge = createChallenge({ status: "selection-completed" });
    const challengeRepository = createInMemoryChallengeRepository([challenge]);
    const useCase = createCompleteSelectionUseCase({ challengeRepository });

    const result = await useCase.execute({ challengeId: challenge.id });

    expect(result).toMatchObject({
      id: challenge.id,
      status: "selection-completed",
    });
    expect(challengeRepository.challenges).toEqual([challenge]);
  });

  it("ignores missing, draft, and archived challenges", async () => {
    const draftChallenge = createChallenge({ id: "challenge-draft", status: "draft" });
    const archivedChallenge = createChallenge({ id: "challenge-archived", status: "archived" });
    const challengeRepository = createInMemoryChallengeRepository([
      draftChallenge,
      archivedChallenge,
    ]);
    const useCase = createCompleteSelectionUseCase({ challengeRepository });

    await expect(useCase.execute({ challengeId: "challenge-missing" })).resolves.toBeNull();
    await expect(useCase.execute({ challengeId: draftChallenge.id })).resolves.toBeNull();
    await expect(useCase.execute({ challengeId: archivedChallenge.id })).resolves.toBeNull();
    expect(challengeRepository.challenges).toEqual([draftChallenge, archivedChallenge]);
  });
});

const createChallenge = (input: {
  readonly status: Challenge["status"];
  readonly id?: string;
}): Challenge => ({
  id: input.id ?? "challenge-1",
  title: "Challenge",
  description: "Challenge description",
  ownerOrganizationId: "org-company",
  status: input.status,
  createdAt: new Date("2026-06-22T10:00:00.000Z"),
  publishedAt: input.status === "draft" ? null : new Date("2026-06-22T11:00:00.000Z"),
});

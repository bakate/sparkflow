import { companyAdminActor, startupMemberActor } from "@sparkflow/testing";
import { describe, expect, it } from "vitest";
import type { ChallengeRepository } from "./ports.ts";
import { createCreateChallengeUseCase } from "./create-challenge.use-case.ts";
import type { Challenge } from "../domain/challenge.ts";

const createInMemoryChallengeRepository = (): ChallengeRepository & {
  readonly challenges: Challenge[];
} => {
  const challenges: Challenge[] = [];

  return {
    challenges,
    save: async ({ challenge }) => {
      challenges.push(challenge);
    },
    findById: async ({ challengeId }) =>
      challenges.find((challenge) => challenge.id === challengeId) ?? null,
    findAll: async () => challenges,
  };
};

describe("CreateChallengeUseCase", () => {
  it("creates a draft challenge for company admins", async () => {
    const challengeRepository = createInMemoryChallengeRepository();
    const useCase = createCreateChallengeUseCase({ challengeRepository });

    const result = await useCase.execute({
      actor: companyAdminActor,
      title: "Circular packaging scouting",
      description: "Find startups for packaging waste reduction.",
    });

    expect(result.ok).toBe(true);
    expect(challengeRepository.challenges).toHaveLength(1);

    if (result.ok) {
      expect(result.value.status).toBe("draft");
    }
  });

  it("rejects non company admins", async () => {
    const challengeRepository = createInMemoryChallengeRepository();
    const useCase = createCreateChallengeUseCase({ challengeRepository });

    const result = await useCase.execute({
      actor: startupMemberActor,
      title: "Circular packaging scouting",
      description: "Find startups for packaging waste reduction.",
    });

    expect(result).toEqual({ ok: false, error: "forbidden" });
  });
});

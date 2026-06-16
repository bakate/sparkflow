import { companyAdminActor, startupMemberActor } from "@sparkflow/testing";
import { describe, expect, it } from "vitest";
import type { Challenge } from "../domain/challenge.ts";
import { createCreateChallengeUseCase } from "./create-challenge.use-case.ts";
import type { ChallengeRepository, Clock, IdGenerator } from "./ports.ts";

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
    findAll: async () => [...challenges],
  };
};

const fixedDate = new Date("2026-06-16T10:00:00.000Z");
const fixedClock: Clock = {
  now: () => fixedDate,
};
const fixedIdGenerator: IdGenerator = {
  generate: () => "2b6c2fed-89d4-4f9b-9cbf-c6d5da96af58",
};

describe("CreateChallengeUseCase", () => {
  it("creates a draft challenge for company admins", async () => {
    const challengeRepository = createInMemoryChallengeRepository();
    const useCase = createCreateChallengeUseCase({
      challengeRepository,
      clock: fixedClock,
      idGenerator: fixedIdGenerator,
    });

    const result = await useCase.execute({
      actor: companyAdminActor,
      title: "Circular packaging scouting",
      description: "Find startups for packaging waste reduction.",
    });

    expect(result.ok).toBe(true);
    expect(challengeRepository.challenges).toHaveLength(1);

    if (result.ok) {
      expect(result.value.id).toBe("2b6c2fed-89d4-4f9b-9cbf-c6d5da96af58");
      expect(result.value.status).toBe("draft");
      expect(result.value.createdAt).toBe("2026-06-16T10:00:00.000Z");
    }
  });

  it("rejects non company admins", async () => {
    const challengeRepository = createInMemoryChallengeRepository();
    const useCase = createCreateChallengeUseCase({
      challengeRepository,
      clock: fixedClock,
      idGenerator: fixedIdGenerator,
    });

    const result = await useCase.execute({
      actor: startupMemberActor,
      title: "Circular packaging scouting",
      description: "Find startups for packaging waste reduction.",
    });

    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("rejects empty challenge titles", async () => {
    const challengeRepository = createInMemoryChallengeRepository();
    const useCase = createCreateChallengeUseCase({
      challengeRepository,
      clock: fixedClock,
      idGenerator: fixedIdGenerator,
    });

    const result = await useCase.execute({
      actor: companyAdminActor,
      title: " ",
      description: "Find startups for packaging waste reduction.",
    });

    expect(result).toEqual({ ok: false, error: "challenge-title-required" });
    expect(challengeRepository.challenges).toHaveLength(0);
  });
});

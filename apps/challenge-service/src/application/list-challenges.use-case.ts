import type { ChallengeDto } from "@sparkflow/contracts";
import { toChallengeDto } from "../domain/challenge.ts";
import type { ChallengeRepository } from "./ports.ts";

export type ListChallengesUseCase = {
  readonly execute: () => Promise<readonly ChallengeDto[]>;
};

export const createListChallengesUseCase = (input: {
  readonly challengeRepository: ChallengeRepository;
}): ListChallengesUseCase => ({
  execute: async () => {
    const challenges = await input.challengeRepository.findAll();

    return challenges.map(toChallengeDto);
  },
});

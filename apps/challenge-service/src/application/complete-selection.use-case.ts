import type { ChallengeDto } from "@sparkflow/contracts";
import { completeChallengeSelection, toChallengeDto } from "../domain/challenge.ts";
import type { ChallengeRepository } from "./ports.ts";

export type CompleteSelectionUseCase = {
  readonly execute: (input: { readonly challengeId: string }) => Promise<ChallengeDto | null>;
};

export const createCompleteSelectionUseCase = (input: {
  readonly challengeRepository: ChallengeRepository;
}): CompleteSelectionUseCase => ({
  execute: async ({ challengeId }) => {
    const challenge = await input.challengeRepository.findById({ challengeId });

    if (challenge === null || challenge.status === "draft" || challenge.status === "archived") {
      return null;
    }

    if (challenge.status === "selection-completed") {
      return toChallengeDto(challenge);
    }

    const completedChallenge = completeChallengeSelection({ challenge });
    await input.challengeRepository.save({ challenge: completedChallenge });

    return toChallengeDto(completedChallenge);
  },
});

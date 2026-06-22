import type { ChallengeDto } from "@sparkflow/contracts";
import { fail, succeed, type Result } from "@sparkflow/result";
import { toChallengeDto } from "../domain/challenge.ts";
import type { ChallengeRepository } from "./ports.ts";

export type GetChallengeUseCase = {
  readonly execute: (input: {
    readonly challengeId: string;
  }) => Promise<Result<"challenge-not-found", ChallengeDto>>;
};

export const createGetChallengeUseCase = (input: {
  readonly challengeRepository: ChallengeRepository;
}): GetChallengeUseCase => ({
  execute: async ({ challengeId }) => {
    const challenge = await input.challengeRepository.findById({ challengeId });

    if (challenge === null) {
      return fail("challenge-not-found");
    }

    return succeed(toChallengeDto(challenge));
  },
});

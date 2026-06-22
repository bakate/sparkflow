import type { ActorContext, ChallengeDto } from "@sparkflow/contracts";
import { fail, succeed, type Result } from "@sparkflow/result";
import { toChallengeDto, updateChallenge, type ChallengeError } from "../domain/challenge.ts";
import type { ChallengeRepository } from "./ports.ts";

export type UpdateChallengeCommand = {
  readonly actor: ActorContext;
  readonly challengeId: string;
  readonly title: string;
  readonly description: string;
};

export type UpdateChallengeUseCase = {
  readonly execute: (
    command: UpdateChallengeCommand,
  ) => Promise<Result<ChallengeError | "challenge-not-found" | "forbidden", ChallengeDto>>;
};

export const createUpdateChallengeUseCase = (input: {
  readonly challengeRepository: ChallengeRepository;
}): UpdateChallengeUseCase => ({
  execute: async (command) => {
    const challenge = await input.challengeRepository.findById({
      challengeId: command.challengeId,
    });

    if (challenge === null) {
      return fail("challenge-not-found");
    }

    if (
      command.actor.role !== "company-admin" ||
      command.actor.organizationId !== challenge.ownerOrganizationId
    ) {
      return fail("forbidden");
    }

    if (command.title.trim().length === 0) {
      return fail("challenge-title-required");
    }

    if (command.description.trim().length === 0) {
      return fail("challenge-description-required");
    }

    const updatedChallenge = updateChallenge({
      challenge,
      title: command.title,
      description: command.description,
    });

    await input.challengeRepository.save({ challenge: updatedChallenge });

    return succeed(toChallengeDto(updatedChallenge));
  },
});

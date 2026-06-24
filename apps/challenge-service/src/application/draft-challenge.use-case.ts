import type { ActorContext, ChallengeDto } from "@sparkflow/contracts";
import { fail, succeed, type Result } from "@sparkflow/result";
import { draftChallenge, toChallengeDto, type ChallengeError } from "../domain/challenge.ts";
import type { ChallengeRepository } from "./ports.ts";

export type DraftChallengeCommand = {
  readonly actor: ActorContext;
  readonly challengeId: string;
};

export type DraftChallengeUseCase = {
  readonly execute: (
    command: DraftChallengeCommand,
  ) => Promise<Result<ChallengeError | "challenge-not-found" | "forbidden", ChallengeDto>>;
};

export const createDraftChallengeUseCase = (input: {
  readonly challengeRepository: ChallengeRepository;
}): DraftChallengeUseCase => ({
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

    if (challenge.status === "draft") {
      return fail("challenge-already-draft");
    }

    if (challenge.status === "archived") {
      return fail("challenge-already-archived");
    }

    if (challenge.status === "selection-completed") {
      return fail("challenge-selection-completed");
    }

    const draftedChallenge = draftChallenge({ challenge });
    await input.challengeRepository.save({ challenge: draftedChallenge });

    return succeed(toChallengeDto(draftedChallenge));
  },
});

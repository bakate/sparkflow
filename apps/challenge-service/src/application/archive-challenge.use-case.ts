import type { ActorContext, ChallengeDto } from "@sparkflow/contracts";
import { fail, succeed, type Result } from "@sparkflow/result";
import { archiveChallenge, toChallengeDto, type ChallengeError } from "../domain/challenge.ts";
import type { ChallengeRepository } from "./ports.ts";

export type ArchiveChallengeCommand = {
  readonly actor: ActorContext;
  readonly challengeId: string;
};

export type ArchiveChallengeUseCase = {
  readonly execute: (
    command: ArchiveChallengeCommand,
  ) => Promise<Result<ChallengeError | "challenge-not-found" | "forbidden", ChallengeDto>>;
};

export const createArchiveChallengeUseCase = (input: {
  readonly challengeRepository: ChallengeRepository;
}): ArchiveChallengeUseCase => ({
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

    if (challenge.status === "archived") {
      return fail("challenge-already-archived");
    }

    const archivedChallenge = archiveChallenge({ challenge });
    await input.challengeRepository.save({ challenge: archivedChallenge });

    return succeed(toChallengeDto(archivedChallenge));
  },
});

import type { ActorContext, ChallengeDto } from "@sparkflow/contracts";
import { fail, succeed, type Result } from "@sparkflow/result";
import { createChallenge, toChallengeDto, type ChallengeError } from "../domain/challenge.ts";
import type { ChallengeRepository, Clock, IdGenerator } from "./ports.ts";

export type CreateChallengeCommand = {
  readonly actor: ActorContext;
  readonly title: string;
  readonly description: string;
};

export type CreateChallengeUseCase = {
  readonly execute: (
    command: CreateChallengeCommand,
  ) => Promise<Result<ChallengeError | "forbidden", ChallengeDto>>;
};

export const createCreateChallengeUseCase = (input: {
  readonly challengeRepository: ChallengeRepository;
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
}): CreateChallengeUseCase => ({
  execute: async (command) => {
    if (command.actor.role !== "company-admin") {
      return fail("forbidden");
    }

    if (command.title.trim().length === 0) {
      return fail("challenge-title-required");
    }

    if (command.description.trim().length === 0) {
      return fail("challenge-description-required");
    }

    const challenge = createChallenge({
      id: input.idGenerator.generate(),
      title: command.title,
      description: command.description,
      ownerOrganizationId: command.actor.organizationId,
      now: input.clock.now(),
    });

    await input.challengeRepository.save({ challenge });

    return succeed(toChallengeDto(challenge));
  },
});

import type { ActorContext, ChallengeDto } from "@sparkflow/contracts";
import { toChallengeDto } from "../domain/challenge.ts";
import type { ChallengeRepository } from "./ports.ts";

export type ListChallengesUseCase = {
  readonly execute: (input: { readonly actor: ActorContext }) => Promise<readonly ChallengeDto[]>;
};

export const createListChallengesUseCase = (input: {
  readonly challengeRepository: ChallengeRepository;
}): ListChallengesUseCase => ({
  execute: async ({ actor }) => {
    const challenges = await input.challengeRepository.findAll();
    const visibleChallenges = challenges.filter((challenge) => {
      if (actor.role === "company-admin") {
        return challenge.ownerOrganizationId === actor.organizationId;
      }

      return challenge.status === "published";
    });

    return visibleChallenges.map(toChallengeDto);
  },
});

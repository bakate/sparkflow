import type { SubmissionDto } from "@sparkflow/contracts";
import { toSubmissionDto } from "../domain/submission.ts";
import type { SubmissionRepository } from "./ports.ts";

export type ListSubmissionsUseCase = {
  readonly execute: (input: { readonly challengeId: string }) => Promise<readonly SubmissionDto[]>;
};

export const createListSubmissionsUseCase = (input: {
  readonly submissionRepository: SubmissionRepository;
}): ListSubmissionsUseCase => ({
  execute: async ({ challengeId }) => {
    const submissions = await input.submissionRepository.findByChallengeId({ challengeId });

    return submissions.map(toSubmissionDto);
  },
});

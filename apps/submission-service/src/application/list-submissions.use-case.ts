import type { CursorPageRequestDto, PaginatedDto, SubmissionDto } from "@sparkflow/contracts";
import { toSubmissionDto } from "../domain/submission.ts";
import type { SubmissionRepository } from "./ports.ts";

export type ListSubmissionsUseCase = {
  readonly execute: (input: {
    readonly challengeId: string;
    readonly page: CursorPageRequestDto;
  }) => Promise<PaginatedDto<SubmissionDto>>;
};

export const createListSubmissionsUseCase = (input: {
  readonly submissionRepository: SubmissionRepository;
}): ListSubmissionsUseCase => ({
  execute: async ({ challengeId, page }) => {
    const submissionsPage = await input.submissionRepository.findPageByChallengeId({
      challengeId,
      page,
    });

    return {
      items: submissionsPage.items.map(toSubmissionDto),
      page: { limit: page.limit, nextCursor: submissionsPage.nextCursor },
    };
  },
});

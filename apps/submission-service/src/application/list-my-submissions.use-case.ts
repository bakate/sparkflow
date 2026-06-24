import type {
  ActorContext,
  CursorPageRequestDto,
  PaginatedDto,
  SubmissionDto,
} from "@sparkflow/contracts";
import { fail, succeed, type Result } from "@sparkflow/result";
import { toSubmissionDto } from "../domain/submission.ts";
import type { SubmissionRepository } from "./ports.ts";

export type ListMySubmissionsUseCase = {
  readonly execute: (input: {
    readonly actor: ActorContext;
    readonly page: CursorPageRequestDto;
  }) => Promise<Result<"forbidden", PaginatedDto<SubmissionDto>>>;
};

export const createListMySubmissionsUseCase = (input: {
  readonly submissionRepository: SubmissionRepository;
}): ListMySubmissionsUseCase => ({
  execute: async ({ actor, page }) => {
    if (actor.role !== "startup-member") {
      return fail("forbidden");
    }

    const submissionsPage = await input.submissionRepository.findPageByStartupOrganizationId({
      startupOrganizationId: actor.organizationId,
      page,
    });

    return succeed({
      items: submissionsPage.items.map(toSubmissionDto),
      page: { limit: page.limit, nextCursor: submissionsPage.nextCursor },
    });
  },
});

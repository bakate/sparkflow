import type { ActorContext, SubmissionDto } from "@sparkflow/contracts";
import { fail, succeed, type Result } from "@sparkflow/result";
import { toSubmissionDto } from "../domain/submission.ts";
import type { SubmissionRepository } from "./ports.ts";

export type ListMySubmissionsUseCase = {
  readonly execute: (input: {
    readonly actor: ActorContext;
  }) => Promise<Result<"forbidden", readonly SubmissionDto[]>>;
};

export const createListMySubmissionsUseCase = (input: {
  readonly submissionRepository: SubmissionRepository;
}): ListMySubmissionsUseCase => ({
  execute: async ({ actor }) => {
    if (actor.role !== "startup-member") {
      return fail("forbidden");
    }

    const submissions = await input.submissionRepository.findByStartupOrganizationId({
      startupOrganizationId: actor.organizationId,
    });

    return succeed(submissions.map(toSubmissionDto));
  },
});

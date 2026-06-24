import type { ActorContext, SubmissionDecisionAuditDto } from "@sparkflow/contracts";
import { fail, succeed, type Result } from "@sparkflow/result";
import { toSubmissionDecisionAuditDto } from "../domain/submission.ts";
import type { SubmissionRepository } from "./ports.ts";

export type ListSubmissionDecisionAuditsCommand = {
  readonly actor: ActorContext;
  readonly submissionId: string;
};

export type ListSubmissionDecisionAuditsUseCase = {
  readonly execute: (
    command: ListSubmissionDecisionAuditsCommand,
  ) => Promise<Result<"forbidden", readonly SubmissionDecisionAuditDto[]>>;
};

export const createListSubmissionDecisionAuditsUseCase = (input: {
  readonly submissionRepository: SubmissionRepository;
}): ListSubmissionDecisionAuditsUseCase => ({
  execute: async (command) => {
    if (command.actor.role !== "company-admin") {
      return fail("forbidden");
    }

    const audits = await input.submissionRepository.findDecisionAuditsBySubmissionId({
      submissionId: command.submissionId,
    });

    return succeed(audits.map(toSubmissionDecisionAuditDto));
  },
});

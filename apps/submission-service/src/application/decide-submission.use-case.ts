import {
  eventNames,
  type ActorContext,
  type DomainEvent,
  type SubmissionDto,
} from "@sparkflow/contracts";
import { fail, succeed, type Result } from "@sparkflow/result";
import {
  acceptSubmission,
  rejectSubmission,
  toSubmissionDto,
  type SubmissionError,
} from "../domain/submission.ts";
import type { Clock, EventPublisher, IdGenerator, SubmissionRepository } from "./ports.ts";

export type SubmissionDecision = "accept" | "reject";

export type DecideSubmissionCommand = {
  readonly actor: ActorContext;
  readonly submissionId: string;
  readonly decision: SubmissionDecision;
  readonly correlationId: string;
};

export type DecideSubmissionUseCase = {
  readonly execute: (
    command: DecideSubmissionCommand,
  ) => Promise<Result<SubmissionError | "forbidden", SubmissionDto>>;
};

export const createDecideSubmissionUseCase = (input: {
  readonly submissionRepository: SubmissionRepository;
  readonly clock: Clock;
  readonly eventPublisher: EventPublisher;
  readonly idGenerator: IdGenerator;
}): DecideSubmissionUseCase => ({
  execute: async (command) => {
    if (command.actor.role !== "company-admin") {
      return fail("forbidden");
    }

    const submission = await input.submissionRepository.findById({
      submissionId: command.submissionId,
    });

    if (submission === null) {
      return fail("submission-not-found");
    }

    if (submission.status !== "submitted") {
      return fail("submission-already-decided");
    }

    const now = input.clock.now();
    const decidedSubmission =
      command.decision === "accept"
        ? acceptSubmission({ submission, now })
        : rejectSubmission({ submission, now });

    await input.submissionRepository.save({ submission: decidedSubmission });

    const event: DomainEvent<SubmissionDto> = {
      eventId: input.idGenerator.generate(),
      eventName:
        command.decision === "accept"
          ? eventNames.submissionAccepted
          : eventNames.submissionRejected,
      occurredAt: now.toISOString(),
      correlationId: command.correlationId,
      producer: "submission-service",
      payload: toSubmissionDto(decidedSubmission),
    };

    await input.eventPublisher.publish({ event });

    return succeed(toSubmissionDto(decidedSubmission));
  },
});

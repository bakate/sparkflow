import {
  eventNames,
  type ActorContext,
  type DomainEvent,
  type SubmissionDto,
} from "@sparkflow/contracts";
import { fail, succeed, type Result } from "@sparkflow/result";
import {
  acceptSubmission,
  markSubmissionNotSelected,
  rejectSubmission,
  selectSubmission,
  toSubmissionDto,
  type Submission,
  type SubmissionError,
} from "../domain/submission.ts";
import type { Clock, EventPublisher, IdGenerator, SubmissionRepository } from "./ports.ts";

export type SubmissionDecision = "accept" | "reject" | "select";

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

    if (command.decision === "select" && submission.status !== "accepted") {
      return fail("submission-not-shortlisted");
    }

    const challengeSubmissions =
      command.decision === "select"
        ? await input.submissionRepository.findByChallengeId({
            challengeId: submission.challengeId,
          })
        : [];

    if (command.decision === "select") {
      const alreadySelected = challengeSubmissions.some(
        (candidate) => candidate.id !== submission.id && candidate.status === "selected",
      );

      if (alreadySelected) {
        return fail("challenge-already-selected");
      }
    }

    if (command.decision !== "select" && submission.status !== "submitted") {
      return fail("submission-already-decided");
    }

    const now = input.clock.now();
    const decidedSubmission = decideSubmission({ decision: command.decision, now, submission });
    const notSelectedSubmissions =
      command.decision === "select"
        ? challengeSubmissions
            .filter(
              (candidate) => candidate.id !== submission.id && candidate.status === "accepted",
            )
            .map((candidate) => markSubmissionNotSelected({ submission: candidate, now }))
        : [];

    const saveResult =
      command.decision === "select"
        ? await input.submissionRepository.saveMany({
            submissions: [decidedSubmission, ...notSelectedSubmissions],
          })
        : await input.submissionRepository.save({ submission: decidedSubmission });

    if (!saveResult.ok) {
      return fail(saveResult.error);
    }

    const event: DomainEvent<SubmissionDto> = {
      eventId: input.idGenerator.generate(),
      eventName:
        command.decision === "accept"
          ? eventNames.submissionAccepted
          : command.decision === "reject"
            ? eventNames.submissionRejected
            : eventNames.submissionSelected,
      occurredAt: now.toISOString(),
      correlationId: command.correlationId,
      producer: "submission-service",
      payload: toSubmissionDto(decidedSubmission),
    };

    await input.eventPublisher.publish({ event });

    return succeed(toSubmissionDto(decidedSubmission));
  },
});

const decideSubmission = (input: {
  readonly decision: SubmissionDecision;
  readonly now: Date;
  readonly submission: Submission;
}): Submission => {
  if (input.decision === "accept") {
    return acceptSubmission({ submission: input.submission, now: input.now });
  }

  if (input.decision === "reject") {
    return rejectSubmission({ submission: input.submission, now: input.now });
  }

  return selectSubmission({ submission: input.submission, now: input.now });
};

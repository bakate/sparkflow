import {
  eventNames,
  type ActorContext,
  type DomainEvent,
  type SubmissionDto,
} from "@sparkflow/contracts";
import { fail, succeed, type Result } from "@sparkflow/result";
import { createSubmission, toSubmissionDto, type SubmissionError } from "../domain/submission.ts";
import type { Clock, EventPublisher, IdGenerator, SubmissionRepository } from "./ports.ts";

export type CreateSubmissionCommand = {
  readonly actor: ActorContext;
  readonly challengeId: string;
  readonly summary: string;
  readonly correlationId: string;
};

export type CreateSubmissionUseCase = {
  readonly execute: (
    command: CreateSubmissionCommand,
  ) => Promise<Result<SubmissionError | "forbidden", SubmissionDto>>;
};

export const createCreateSubmissionUseCase = (input: {
  readonly submissionRepository: SubmissionRepository;
  readonly clock: Clock;
  readonly eventPublisher: EventPublisher;
  readonly idGenerator: IdGenerator;
}): CreateSubmissionUseCase => ({
  execute: async (command) => {
    if (command.actor.role !== "startup-member") {
      return fail("forbidden");
    }

    if (command.summary.trim().length === 0) {
      return fail("submission-summary-required");
    }

    const submission = createSubmission({
      id: input.idGenerator.generate(),
      challengeId: command.challengeId,
      startupOrganizationId: command.actor.organizationId,
      summary: command.summary,
      now: input.clock.now(),
    });

    await input.submissionRepository.save({ submission });

    const event: DomainEvent<SubmissionDto> = {
      eventId: input.idGenerator.generate(),
      eventName: eventNames.submissionCreated,
      occurredAt: submission.createdAt.toISOString(),
      correlationId: command.correlationId,
      producer: "submission-service",
      payload: toSubmissionDto(submission),
    };

    await input.eventPublisher.publish({ event });

    return succeed(toSubmissionDto(submission));
  },
});

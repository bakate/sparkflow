import {
  eventNames,
  type ActorContext,
  type DomainEvent,
  type SubmissionDto,
} from "@sparkflow/contracts";
import { fail, succeed, type Result } from "@sparkflow/result";
import { randomUUID } from "node:crypto";
import { createSubmission, toSubmissionDto, type SubmissionError } from "../domain/submission.ts";
import type { EventPublisher, SubmissionRepository } from "./ports.ts";

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
  readonly eventPublisher: EventPublisher;
}): CreateSubmissionUseCase => ({
  execute: async (command) => {
    if (command.actor.role !== "startup-member") {
      return fail("forbidden");
    }

    if (command.summary.trim().length === 0) {
      return fail("submission-summary-required");
    }

    const submission = createSubmission({
      id: randomUUID(),
      challengeId: command.challengeId,
      startupOrganizationId: command.actor.organizationId,
      summary: command.summary,
      now: new Date(),
    });

    await input.submissionRepository.save({ submission });

    const event: DomainEvent = {
      eventId: randomUUID(),
      eventName: eventNames.submissionCreated,
      occurredAt: new Date().toISOString(),
      correlationId: command.correlationId,
      producer: "submission-service",
      payload: toSubmissionDto(submission),
    };

    await input.eventPublisher.publish({ event });

    return succeed(toSubmissionDto(submission));
  },
});

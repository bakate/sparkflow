import {
  eventNames,
  type ActorContext,
  type ChallengeDto,
  type DomainEvent,
} from "@sparkflow/contracts";
import { fail, succeed, type Result } from "@sparkflow/result";
import { randomUUID } from "node:crypto";
import { publishChallenge, toChallengeDto, type ChallengeError } from "../domain/challenge.ts";
import type { ChallengeRepository, EventPublisher } from "./ports.ts";

export type PublishChallengeCommand = {
  readonly actor: ActorContext;
  readonly challengeId: string;
  readonly correlationId: string;
};

export type PublishChallengeUseCase = {
  readonly execute: (
    command: PublishChallengeCommand,
  ) => Promise<Result<ChallengeError | "challenge-not-found" | "forbidden", ChallengeDto>>;
};

export const createPublishChallengeUseCase = (input: {
  readonly challengeRepository: ChallengeRepository;
  readonly eventPublisher: EventPublisher;
}): PublishChallengeUseCase => ({
  execute: async (command) => {
    const challenge = await input.challengeRepository.findById({
      challengeId: command.challengeId,
    });

    if (challenge === null) {
      return fail("challenge-not-found");
    }

    if (
      command.actor.role !== "company-admin" ||
      command.actor.organizationId !== challenge.ownerOrganizationId
    ) {
      return fail("forbidden");
    }

    if (challenge.status === "published") {
      return fail("challenge-already-published");
    }

    const publishedChallenge = publishChallenge({ challenge, now: new Date() });
    await input.challengeRepository.save({ challenge: publishedChallenge });

    const event: DomainEvent = {
      eventId: randomUUID(),
      eventName: eventNames.challengePublished,
      occurredAt: new Date().toISOString(),
      correlationId: command.correlationId,
      producer: "challenge-service",
      payload: toChallengeDto(publishedChallenge),
    };

    await input.eventPublisher.publish({ event });

    return succeed(toChallengeDto(publishedChallenge));
  },
});

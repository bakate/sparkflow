import {
  eventNames,
  type DomainEvent,
  type EvaluationDto,
  type NotificationDto,
  type SubmissionDto,
} from "@sparkflow/contracts";
import { randomUUID } from "node:crypto";
import { createNotification, toNotificationDto } from "../domain/notification.ts";
import type { NotificationRepository } from "./ports.ts";

export type CreateNotificationFromEventUseCase = {
  readonly execute: (input: { readonly event: DomainEvent }) => Promise<NotificationDto | null>;
};

const isSubmissionPayload = (payload: unknown): payload is SubmissionDto => {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  return "startupOrganizationId" in payload && "challengeId" in payload;
};

const isEvaluationPayload = (payload: unknown): payload is EvaluationDto => {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  return "submissionId" in payload && "score" in payload;
};

const buildNotificationText = (
  event: DomainEvent,
): {
  readonly recipientOrganizationId: string;
  readonly title: string;
  readonly message: string;
} | null => {
  if (
    (event.eventName === eventNames.submissionAccepted ||
      event.eventName === eventNames.submissionRejected ||
      event.eventName === eventNames.submissionCreated) &&
    isSubmissionPayload(event.payload)
  ) {
    return {
      recipientOrganizationId: event.payload.startupOrganizationId,
      title:
        event.eventName === eventNames.submissionCreated
          ? "Submission received"
          : `Submission ${event.payload.status}`,
      message: `Submission ${event.payload.id} is now ${event.payload.status}.`,
    };
  }

  if (event.eventName === eventNames.evaluationSubmitted && isEvaluationPayload(event.payload)) {
    return {
      recipientOrganizationId: "org-company",
      title: "Evaluation submitted",
      message: `Reviewer scored submission ${event.payload.submissionId} at ${event.payload.score}/100.`,
    };
  }

  return null;
};

export const createCreateNotificationFromEventUseCase = (input: {
  readonly notificationRepository: NotificationRepository;
}): CreateNotificationFromEventUseCase => ({
  execute: async ({ event }) => {
    const alreadyHandled = await input.notificationRepository.existsByEventId({
      eventId: event.eventId,
    });

    if (alreadyHandled) {
      return null;
    }

    const notificationText = buildNotificationText(event);

    if (notificationText === null) {
      return null;
    }

    const notification = createNotification({
      id: randomUUID(),
      eventId: event.eventId,
      recipientOrganizationId: notificationText.recipientOrganizationId,
      title: notificationText.title,
      message: notificationText.message,
      now: new Date(),
    });

    await input.notificationRepository.save({ notification });

    return toNotificationDto(notification);
  },
});

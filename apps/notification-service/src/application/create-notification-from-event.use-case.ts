import {
  eventNames,
  type DomainEvent,
  type EvaluationDto,
  type NotificationDto,
  type SubmissionDto,
} from "@sparkflow/contracts";
import { createNotification, toNotificationDto } from "../domain/notification.ts";
import type { Clock, IdGenerator, NotificationRepository } from "./ports.ts";

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
  readonly actionUrl: string | null;
} | null => {
  if (
    (event.eventName === eventNames.submissionAccepted ||
      event.eventName === eventNames.submissionRejected ||
      event.eventName === eventNames.submissionSelected ||
      event.eventName === eventNames.submissionCreated) &&
    isSubmissionPayload(event.payload)
  ) {
    const notificationTextByStatus: Record<
      SubmissionDto["status"],
      { readonly title: string; readonly message: string }
    > = {
      accepted: {
        title: "Proposal shortlisted",
        message: "Your proposal was shortlisted. Track the next steps in My opportunities.",
      },
      rejected: {
        title: "Proposal not retained",
        message: "Your proposal was not retained. Review the feedback in My opportunities.",
      },
      selected: {
        title: "Final project selected",
        message: "You were selected for the final project. Open My opportunities for details.",
      },
      submitted: {
        title: "Proposal sent",
        message: "Your proposal was sent and is waiting for company review.",
      },
      "not-selected": {
        title: "Not finally selected",
        message: "Your shortlisted proposal was not selected for the final project.",
      },
    };
    const notificationText = notificationTextByStatus[event.payload.status];

    return {
      recipientOrganizationId: event.payload.startupOrganizationId,
      title: notificationText.title,
      message: notificationText.message,
      actionUrl: `/opportunities?submissionId=${encodeURIComponent(event.payload.id)}`,
    };
  }

  if (event.eventName === eventNames.evaluationSubmitted && isEvaluationPayload(event.payload)) {
    return {
      recipientOrganizationId: "org-company",
      title: "Evaluation submitted",
      message: `Reviewer scored submission ${event.payload.submissionId} at ${event.payload.score}/100.`,
      actionUrl: null,
    };
  }

  return null;
};

export const createCreateNotificationFromEventUseCase = (input: {
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
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
      id: input.idGenerator.generate(),
      eventId: event.eventId,
      recipientOrganizationId: notificationText.recipientOrganizationId,
      title: notificationText.title,
      message: notificationText.message,
      actionUrl: notificationText.actionUrl,
      now: input.clock.now(),
    });

    await input.notificationRepository.save({ notification });

    return toNotificationDto(notification);
  },
});

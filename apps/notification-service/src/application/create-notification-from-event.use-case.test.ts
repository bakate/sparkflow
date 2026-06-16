import { eventNames, type DomainEvent, type SubmissionDto } from "@sparkflow/contracts";
import { describe, expect, it } from "vitest";
import type { Notification } from "../domain/notification.ts";
import { createCreateNotificationFromEventUseCase } from "./create-notification-from-event.use-case.ts";
import type { Clock, IdGenerator, NotificationRepository } from "./ports.ts";

const fixedCreatedAt = new Date("2026-06-16T10:00:00.000Z");
const fixedClock: Clock = {
  now: () => fixedCreatedAt,
};
const fixedIdGenerator: IdGenerator = {
  generate: () => "notification-2b6c2fed-89d4-4f9b-9cbf-c6d5da96af58",
};

const createInMemoryNotificationRepository = (
  initialNotifications: readonly Notification[] = [],
): NotificationRepository & {
  readonly notifications: Notification[];
} => {
  const notifications = [...initialNotifications];

  return {
    notifications,
    save: async ({ notification }) => {
      const alreadyExists = notifications.some(
        (candidate) => candidate.eventId === notification.eventId,
      );

      if (alreadyExists) {
        return;
      }

      notifications.push(notification);
    },
    existsByEventId: async ({ eventId }) =>
      notifications.some((notification) => notification.eventId === eventId),
    findByOrganizationId: async ({ organizationId }) =>
      notifications.filter(
        (notification) => notification.recipientOrganizationId === organizationId,
      ),
  };
};

const createSubmissionEvent = (input: {
  readonly eventName:
    | typeof eventNames.submissionAccepted
    | typeof eventNames.submissionCreated
    | typeof eventNames.submissionRejected;
  readonly status: SubmissionDto["status"];
}): DomainEvent<SubmissionDto> => ({
  eventId: "event-2b6c2fed-89d4-4f9b-9cbf-c6d5da96af58",
  eventName: input.eventName,
  occurredAt: "2026-06-16T09:00:00.000Z",
  correlationId: "correlation-id",
  producer: "submission-service",
  payload: {
    id: "submission-id",
    challengeId: "challenge-id",
    startupOrganizationId: "startup-organization-id",
    summary: "Bio-based packaging solution.",
    status: input.status,
    createdAt: "2026-06-16T09:00:00.000Z",
    decidedAt: input.status === "submitted" ? null : "2026-06-16T10:00:00.000Z",
  },
});

describe("CreateNotificationFromEventUseCase", () => {
  it("creates a notification from submission.created", async () => {
    const notificationRepository = createInMemoryNotificationRepository();
    const useCase = createCreateNotificationFromEventUseCase({
      clock: fixedClock,
      idGenerator: fixedIdGenerator,
      notificationRepository,
    });

    const notification = await useCase.execute({
      event: createSubmissionEvent({
        eventName: eventNames.submissionCreated,
        status: "submitted",
      }),
    });

    expect(notification).toMatchObject({
      id: "notification-2b6c2fed-89d4-4f9b-9cbf-c6d5da96af58",
      eventId: "event-2b6c2fed-89d4-4f9b-9cbf-c6d5da96af58",
      recipientOrganizationId: "startup-organization-id",
      title: "Submission received",
      message: "Submission submission-id is now submitted.",
      createdAt: "2026-06-16T10:00:00.000Z",
    });
    expect(notificationRepository.notifications).toHaveLength(1);
  });

  it("creates a notification from submission.accepted", async () => {
    const notificationRepository = createInMemoryNotificationRepository();
    const useCase = createCreateNotificationFromEventUseCase({
      clock: fixedClock,
      idGenerator: fixedIdGenerator,
      notificationRepository,
    });

    const notification = await useCase.execute({
      event: createSubmissionEvent({
        eventName: eventNames.submissionAccepted,
        status: "accepted",
      }),
    });

    expect(notification?.title).toBe("Submission accepted");
    expect(notificationRepository.notifications).toHaveLength(1);
  });

  it("does not create duplicate notifications for the same event id", async () => {
    const existingNotification: Notification = {
      id: "existing-notification-id",
      eventId: "event-2b6c2fed-89d4-4f9b-9cbf-c6d5da96af58",
      recipientOrganizationId: "startup-organization-id",
      title: "Existing notification",
      message: "Already handled.",
      createdAt: fixedCreatedAt,
    };
    const notificationRepository = createInMemoryNotificationRepository([existingNotification]);
    const useCase = createCreateNotificationFromEventUseCase({
      clock: fixedClock,
      idGenerator: fixedIdGenerator,
      notificationRepository,
    });

    const notification = await useCase.execute({
      event: createSubmissionEvent({
        eventName: eventNames.submissionCreated,
        status: "submitted",
      }),
    });

    expect(notification).toBeNull();
    expect(notificationRepository.notifications).toHaveLength(1);
  });

  it("ignores unsupported events", async () => {
    const notificationRepository = createInMemoryNotificationRepository();
    const useCase = createCreateNotificationFromEventUseCase({
      clock: fixedClock,
      idGenerator: fixedIdGenerator,
      notificationRepository,
    });

    const notification = await useCase.execute({
      event: {
        eventId: "event-id",
        eventName: eventNames.challengePublished,
        occurredAt: "2026-06-16T09:00:00.000Z",
        correlationId: "correlation-id",
        producer: "challenge-service",
        payload: {},
      },
    });

    expect(notification).toBeNull();
    expect(notificationRepository.notifications).toHaveLength(0);
  });
});

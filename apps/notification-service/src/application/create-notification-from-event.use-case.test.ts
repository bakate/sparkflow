import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DomainEvent, EventName } from "@sparkflow/contracts";
import { describe, expect, it } from "vitest";
import type { Notification } from "../domain/notification.ts";
import { createCreateNotificationFromEventUseCase } from "./create-notification-from-event.use-case.ts";
import type { Clock, IdGenerator, NotificationRepository } from "./ports.ts";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const fixturesDirectory = join(currentDirectory, "../../../../packages/contracts/fixtures");

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

type JsonRecord = {
  readonly [key: string]: unknown;
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readDomainEventFixture = async (input: {
  readonly fileName: string;
  readonly eventName: EventName;
}): Promise<DomainEvent> => {
  const fileContent = await readFile(join(fixturesDirectory, input.fileName), "utf8");
  const parsed: unknown = JSON.parse(fileContent);

  if (
    !isRecord(parsed) ||
    !isRecord(parsed.payload) ||
    typeof parsed.eventId !== "string" ||
    parsed.eventName !== input.eventName ||
    typeof parsed.occurredAt !== "string" ||
    typeof parsed.correlationId !== "string" ||
    typeof parsed.producer !== "string"
  ) {
    expect.fail("Fixture must be a valid domain event");
  }

  return parsed as unknown as DomainEvent;
};

const createUseCase = (input?: {
  readonly initialNotifications?: readonly Notification[];
}): {
  readonly notificationRepository: NotificationRepository & {
    readonly notifications: Notification[];
  };
  readonly useCase: ReturnType<typeof createCreateNotificationFromEventUseCase>;
} => {
  const notificationRepository = createInMemoryNotificationRepository(
    input?.initialNotifications ?? [],
  );
  const useCase = createCreateNotificationFromEventUseCase({
    clock: fixedClock,
    idGenerator: fixedIdGenerator,
    notificationRepository,
  });

  return { notificationRepository, useCase };
};

describe("CreateNotificationFromEventUseCase", () => {
  it.each([
    {
      fileName: "submission-created-event.json",
      eventName: "submission.created",
      title: "Submission received",
      message: "Submission submission-2b6c2fed-89d4-4f9b-9cbf-c6d5da96af58 is now submitted.",
    },
    {
      fileName: "submission-accepted-event.json",
      eventName: "submission.accepted",
      title: "Submission accepted",
      message: "Submission submission-2b6c2fed-89d4-4f9b-9cbf-c6d5da96af58 is now accepted.",
    },
    {
      fileName: "submission-rejected-event.json",
      eventName: "submission.rejected",
      title: "Submission rejected",
      message: "Submission submission-2b6c2fed-89d4-4f9b-9cbf-c6d5da96af58 is now rejected.",
    },
  ] as const)(
    "creates a notification from $eventName fixture",
    async ({ eventName, fileName, message, title }) => {
      const { notificationRepository, useCase } = createUseCase();
      const event = await readDomainEventFixture({ eventName, fileName });

      const notification = await useCase.execute({ event });

      expect(notification).toMatchObject({
        id: "notification-2b6c2fed-89d4-4f9b-9cbf-c6d5da96af58",
        eventId: event.eventId,
        recipientOrganizationId: "org-startup",
        title,
        message,
        createdAt: "2026-06-16T10:00:00.000Z",
      });
      expect(notificationRepository.notifications).toHaveLength(1);
    },
  );

  it("creates a notification from evaluation.submitted fixture", async () => {
    const { notificationRepository, useCase } = createUseCase();
    const event = await readDomainEventFixture({
      fileName: "evaluation-submitted-event.json",
      eventName: "evaluation.submitted",
    });

    const notification = await useCase.execute({ event });

    expect(notification).toMatchObject({
      id: "notification-2b6c2fed-89d4-4f9b-9cbf-c6d5da96af58",
      eventId: event.eventId,
      recipientOrganizationId: "org-company",
      title: "Evaluation submitted",
      message:
        "Reviewer scored submission submission-2b6c2fed-89d4-4f9b-9cbf-c6d5da96af58 at 91/100.",
      createdAt: "2026-06-16T10:00:00.000Z",
    });
    expect(notificationRepository.notifications).toHaveLength(1);
  });

  it("does not create duplicate notifications for the same event id", async () => {
    const event = await readDomainEventFixture({
      fileName: "submission-created-event.json",
      eventName: "submission.created",
    });
    const existingNotification: Notification = {
      id: "existing-notification-id",
      eventId: event.eventId,
      recipientOrganizationId: "org-startup",
      title: "Existing notification",
      message: "Already handled.",
      createdAt: fixedCreatedAt,
    };
    const { notificationRepository, useCase } = createUseCase({
      initialNotifications: [existingNotification],
    });

    const notification = await useCase.execute({ event });

    expect(notification).toBeNull();
    expect(notificationRepository.notifications).toHaveLength(1);
  });

  it("ignores unsupported events", async () => {
    const { notificationRepository, useCase } = createUseCase();
    const event = await readDomainEventFixture({
      fileName: "challenge-published-event.json",
      eventName: "challenge.published",
    });

    const notification = await useCase.execute({ event });

    expect(notification).toBeNull();
    expect(notificationRepository.notifications).toHaveLength(0);
  });
});

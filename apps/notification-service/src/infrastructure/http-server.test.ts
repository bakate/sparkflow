import type { NotificationDto } from "@sparkflow/contracts";
import { afterEach, describe, expect, it } from "vitest";
import type { ListNotificationsUseCase } from "../application/list-notifications.use-case.js";
import { buildNotificationHttpServer } from "./http-server.js";

const notificationDto: NotificationDto = {
  id: "notification-1",
  eventId: "event-1",
  recipientOrganizationId: "org-startup",
  title: "Submission accepted",
  message: "Submission submission-1 is now accepted.",
  actionUrl: "/opportunities?submissionId=submission-1",
  createdAt: "2026-06-16T10:00:00.000Z",
};

const openServers: { readonly close: () => Promise<void> }[] = [];

const readRecordedCommand = (input: {
  readonly commands: readonly { readonly organizationId: string }[];
}): { readonly organizationId: string } => {
  const command = input.commands[0];

  if (command === undefined) {
    expect.fail("Missing recorded command");
  }

  return command;
};

const createRecordingListNotificationsUseCase = (input: {
  readonly notifications: readonly NotificationDto[];
}): ListNotificationsUseCase & {
  readonly commands: { readonly organizationId: string }[];
} => {
  const commands: { readonly organizationId: string }[] = [];

  return {
    commands,
    execute: async (command) => {
      commands.push(command);
      return input.notifications;
    },
  };
};

const createServer = async (input?: {
  readonly listNotificationsUseCase?: ListNotificationsUseCase;
}) => {
  const server = await buildNotificationHttpServer({
    listNotificationsUseCase:
      input?.listNotificationsUseCase ??
      createRecordingListNotificationsUseCase({ notifications: [] }),
  });

  openServers.push(server);

  return server;
};

afterEach(async () => {
  const serversToClose = [...openServers];
  openServers.length = 0;

  await Promise.all(serversToClose.map((server) => server.close()));
});

describe("buildNotificationHttpServer", () => {
  it("returns health without calling the notification use case", async () => {
    const listNotificationsUseCase = createRecordingListNotificationsUseCase({
      notifications: [notificationDto],
    });
    const server = await createServer({ listNotificationsUseCase });

    const response = await server.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
    expect(listNotificationsUseCase.commands).toEqual([]);
  });

  it("lists notifications for the organization from request headers", async () => {
    const listNotificationsUseCase = createRecordingListNotificationsUseCase({
      notifications: [notificationDto],
    });
    const server = await createServer({ listNotificationsUseCase });

    const response = await server.inject({
      method: "GET",
      url: "/notifications",
      headers: {
        "x-organization-id": "org-startup",
      },
    });

    const command = readRecordedCommand({ commands: listNotificationsUseCase.commands });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([notificationDto]);
    expect(command).toEqual({ organizationId: "org-startup" });
  });

  it("uses an explicit unknown organization fallback when the header is missing", async () => {
    const listNotificationsUseCase = createRecordingListNotificationsUseCase({
      notifications: [],
    });
    const server = await createServer({ listNotificationsUseCase });

    const response = await server.inject({
      method: "GET",
      url: "/notifications",
    });

    const command = readRecordedCommand({ commands: listNotificationsUseCase.commands });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
    expect(command).toEqual({ organizationId: "unknown-organization" });
  });
});

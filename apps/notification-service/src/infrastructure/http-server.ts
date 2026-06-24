import cors from "@fastify/cors";
import Fastify from "fastify";
import type { ListNotificationsUseCase } from "../application/list-notifications.use-case.ts";
import type { MarkAllNotificationsReadUseCase } from "../application/mark-all-notifications-read.use-case.ts";
import type { MarkNotificationReadUseCase } from "../application/mark-notification-read.use-case.ts";

export const buildNotificationHttpServer = async (input: {
  readonly listNotificationsUseCase: ListNotificationsUseCase;
  readonly markAllNotificationsReadUseCase: MarkAllNotificationsReadUseCase;
  readonly markNotificationReadUseCase: MarkNotificationReadUseCase;
}) => {
  const server = Fastify({ logger: false });
  await server.register(cors);

  server.get("/health", async () => ({ status: "ok" }));

  server.get("/notifications", async (request) =>
    input.listNotificationsUseCase.execute({
      organizationId: String(request.headers["x-organization-id"] ?? "unknown-organization"),
    }),
  );

  server.post("/notifications/read-all", async (request) =>
    input.markAllNotificationsReadUseCase.execute({
      organizationId: String(request.headers["x-organization-id"] ?? "unknown-organization"),
    }),
  );

  server.post<{
    readonly Params: {
      readonly notificationId: string;
    };
  }>("/notifications/:notificationId/read", async (request, reply) => {
    const notification = await input.markNotificationReadUseCase.execute({
      notificationId: String(request.params.notificationId),
      organizationId: String(request.headers["x-organization-id"] ?? "unknown-organization"),
    });

    if (notification === null) {
      return reply.status(404).send({ error: "notification-not-found" });
    }

    return notification;
  });

  return server;
};

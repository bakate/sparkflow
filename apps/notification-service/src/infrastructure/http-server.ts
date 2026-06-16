import cors from "@fastify/cors";
import Fastify from "fastify";
import type { ListNotificationsUseCase } from "../application/list-notifications.use-case.ts";

export const buildNotificationHttpServer = async (input: {
  readonly listNotificationsUseCase: ListNotificationsUseCase;
}) => {
  const server = Fastify({ logger: false });
  await server.register(cors);

  server.get("/health", async () => ({ status: "ok" }));

  server.get("/notifications", async (request) =>
    input.listNotificationsUseCase.execute({
      organizationId: String(request.headers["x-organization-id"] ?? "unknown-organization"),
    }),
  );

  return server;
};

import cors from "@fastify/cors";
import Fastify from "fastify";
import type { ListUsersUseCase } from "../application/list-users.use-case.ts";

export const buildIdentityHttpServer = async (input: {
  readonly listUsersUseCase: ListUsersUseCase;
}) => {
  const server = Fastify({ logger: false });
  await server.register(cors);

  server.get("/health", async () => ({ status: "ok" }));
  server.get("/users", async () => input.listUsersUseCase.execute());

  return server;
};

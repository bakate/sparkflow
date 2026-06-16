import cors from "@fastify/cors";
import { readEnvironmentVariable, readIntegerEnvironmentVariable } from "@sparkflow/config";
import { logger } from "@sparkflow/logger";
import Fastify from "fastify";
import { randomUUID } from "node:crypto";

type ServiceResponse = {
  readonly statusCode: number;
  readonly body: unknown;
};

const port = readIntegerEnvironmentVariable({ name: "PORT", fallback: 3000 });
const identityServiceUrl = readEnvironmentVariable({
  name: "IDENTITY_SERVICE_URL",
  fallback: "http://localhost:4000",
});
const challengeServiceUrl = readEnvironmentVariable({
  name: "CHALLENGE_SERVICE_URL",
  fallback: "http://localhost:4001",
});
const submissionServiceUrl = readEnvironmentVariable({
  name: "SUBMISSION_SERVICE_URL",
  fallback: "http://localhost:4002",
});
const notificationServiceUrl = readEnvironmentVariable({
  name: "NOTIFICATION_SERVICE_URL",
  fallback: "http://localhost:4003",
});
const evaluationServiceUrl = readEnvironmentVariable({
  name: "EVALUATION_SERVICE_URL",
  fallback: "http://localhost:4004",
});

const createForwardHeaders = (input: {
  readonly headers: Record<string, string | string[] | undefined>;
}): Headers => {
  const headers = new Headers();
  headers.set("content-type", "application/json");
  headers.set("x-correlation-id", String(input.headers["x-correlation-id"] ?? randomUUID()));
  headers.set("x-user-id", String(input.headers["x-user-id"] ?? "user-company-admin"));
  headers.set("x-organization-id", String(input.headers["x-organization-id"] ?? "org-company"));
  headers.set("x-role", String(input.headers["x-role"] ?? "company-admin"));

  return headers;
};

const proxyJson = async (input: {
  readonly url: string;
  readonly method: "GET" | "POST";
  readonly headers: Record<string, string | string[] | undefined>;
  readonly body?: unknown;
}): Promise<ServiceResponse> => {
  const requestInit: RequestInit =
    input.body === undefined
      ? {
          method: input.method,
          headers: createForwardHeaders({ headers: input.headers }),
        }
      : {
          method: input.method,
          headers: createForwardHeaders({ headers: input.headers }),
          body: JSON.stringify(input.body),
        };

  const response = await fetch(input.url, {
    ...requestInit,
  });
  const text = await response.text();
  const body: unknown = text.length === 0 ? null : JSON.parse(text);

  return {
    statusCode: response.status,
    body,
  };
};

const server = Fastify({ logger: false });
await server.register(cors, { origin: true });

server.get("/health", async () => ({ status: "ok" }));

server.get("/users", async (request, reply) => {
  const response = await proxyJson({
    url: `${identityServiceUrl}/users`,
    method: "GET",
    headers: request.headers,
  });

  return reply.code(response.statusCode).send(response.body);
});

server.get("/challenges", async (request, reply) => {
  const response = await proxyJson({
    url: `${challengeServiceUrl}/challenges`,
    method: "GET",
    headers: request.headers,
  });

  return reply.code(response.statusCode).send(response.body);
});

server.post<{ Body: unknown }>("/challenges", async (request, reply) => {
  const response = await proxyJson({
    url: `${challengeServiceUrl}/challenges`,
    method: "POST",
    headers: request.headers,
    body: request.body,
  });

  return reply.code(response.statusCode).send(response.body);
});

server.post<{ Params: { readonly challengeId: string } }>(
  "/challenges/:challengeId/publish",
  async (request, reply) => {
    const response = await proxyJson({
      url: `${challengeServiceUrl}/challenges/${request.params.challengeId}/publish`,
      method: "POST",
      headers: request.headers,
    });

    return reply.code(response.statusCode).send(response.body);
  },
);

server.get<{ Params: { readonly challengeId: string } }>(
  "/challenges/:challengeId/submissions",
  async (request, reply) => {
    const response = await proxyJson({
      url: `${submissionServiceUrl}/challenges/${request.params.challengeId}/submissions`,
      method: "GET",
      headers: request.headers,
    });

    return reply.code(response.statusCode).send(response.body);
  },
);

server.post<{ Params: { readonly challengeId: string }; Body: unknown }>(
  "/challenges/:challengeId/submissions",
  async (request, reply) => {
    const response = await proxyJson({
      url: `${submissionServiceUrl}/challenges/${request.params.challengeId}/submissions`,
      method: "POST",
      headers: request.headers,
      body: request.body,
    });

    return reply.code(response.statusCode).send(response.body);
  },
);

server.post<{ Params: { readonly submissionId: string }; Body: unknown }>(
  "/submissions/:submissionId/evaluations",
  async (request, reply) => {
    const response = await proxyJson({
      url: `${evaluationServiceUrl}/submissions/${request.params.submissionId}/evaluations`,
      method: "POST",
      headers: request.headers,
      body: request.body,
    });

    return reply.code(response.statusCode).send(response.body);
  },
);

server.post<{ Params: { readonly submissionId: string } }>(
  "/submissions/:submissionId/accept",
  async (request, reply) => {
    const response = await proxyJson({
      url: `${submissionServiceUrl}/submissions/${request.params.submissionId}/accept`,
      method: "POST",
      headers: request.headers,
    });

    return reply.code(response.statusCode).send(response.body);
  },
);

server.post<{ Params: { readonly submissionId: string } }>(
  "/submissions/:submissionId/reject",
  async (request, reply) => {
    const response = await proxyJson({
      url: `${submissionServiceUrl}/submissions/${request.params.submissionId}/reject`,
      method: "POST",
      headers: request.headers,
    });

    return reply.code(response.statusCode).send(response.body);
  },
);

server.get("/notifications", async (request, reply) => {
  const response = await proxyJson({
    url: `${notificationServiceUrl}/notifications`,
    method: "GET",
    headers: request.headers,
  });

  return reply.code(response.statusCode).send(response.body);
});

await server.listen({ host: "0.0.0.0", port });
logger.info("api-gateway started", { port });

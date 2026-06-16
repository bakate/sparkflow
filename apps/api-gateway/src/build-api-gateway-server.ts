import cors from "@fastify/cors";
import Fastify from "fastify";

type ServiceResponse = {
  readonly statusCode: number;
  readonly body: unknown;
};

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

type IdGenerator = {
  readonly generate: () => string;
};

export type ApiGatewayServiceUrls = {
  readonly identityServiceUrl: string;
  readonly challengeServiceUrl: string;
  readonly submissionServiceUrl: string;
  readonly notificationServiceUrl: string;
  readonly evaluationServiceUrl: string;
};

const createForwardHeaders = (input: {
  readonly headers: Record<string, string | string[] | undefined>;
  readonly idGenerator: IdGenerator;
}): Headers => {
  const headers = new Headers();
  headers.set("content-type", "application/json");
  headers.set(
    "x-correlation-id",
    String(input.headers["x-correlation-id"] ?? input.idGenerator.generate()),
  );
  headers.set("x-user-id", String(input.headers["x-user-id"] ?? "user-company-admin"));
  headers.set("x-organization-id", String(input.headers["x-organization-id"] ?? "org-company"));
  headers.set("x-role", String(input.headers["x-role"] ?? "company-admin"));

  return headers;
};

const proxyJson = async (input: {
  readonly fetcher: Fetcher;
  readonly idGenerator: IdGenerator;
  readonly url: string;
  readonly method: "GET" | "POST";
  readonly headers: Record<string, string | string[] | undefined>;
  readonly body?: unknown;
}): Promise<ServiceResponse> => {
  const headers = createForwardHeaders({
    headers: input.headers,
    idGenerator: input.idGenerator,
  });
  const requestInit: RequestInit =
    input.body === undefined
      ? {
          method: input.method,
          headers,
        }
      : {
          method: input.method,
          headers,
          body: JSON.stringify(input.body),
        };

  const response = await input.fetcher(input.url, requestInit);
  const text = await response.text();

  return {
    statusCode: response.status,
    body: text.length === 0 ? null : JSON.parse(text),
  };
};

export const buildApiGatewayServer = async (input: {
  readonly fetcher: Fetcher;
  readonly idGenerator: IdGenerator;
  readonly serviceUrls: ApiGatewayServiceUrls;
}) => {
  const server = Fastify({ logger: false });
  await server.register(cors, { origin: true });

  const proxy = (requestInput: {
    readonly url: string;
    readonly method: "GET" | "POST";
    readonly headers: Record<string, string | string[] | undefined>;
    readonly body?: unknown;
  }) =>
    proxyJson({
      fetcher: input.fetcher,
      idGenerator: input.idGenerator,
      ...requestInput,
    });

  server.get("/health", async () => ({ status: "ok" }));

  server.get("/users", async (request, reply) => {
    const response = await proxy({
      url: `${input.serviceUrls.identityServiceUrl}/users`,
      method: "GET",
      headers: request.headers,
    });

    return reply.code(response.statusCode).send(response.body);
  });

  server.get("/challenges", async (request, reply) => {
    const response = await proxy({
      url: `${input.serviceUrls.challengeServiceUrl}/challenges`,
      method: "GET",
      headers: request.headers,
    });

    return reply.code(response.statusCode).send(response.body);
  });

  server.post<{ Body: unknown }>("/challenges", async (request, reply) => {
    const response = await proxy({
      url: `${input.serviceUrls.challengeServiceUrl}/challenges`,
      method: "POST",
      headers: request.headers,
      body: request.body,
    });

    return reply.code(response.statusCode).send(response.body);
  });

  server.post<{ Params: { readonly challengeId: string } }>(
    "/challenges/:challengeId/publish",
    async (request, reply) => {
      const response = await proxy({
        url: `${input.serviceUrls.challengeServiceUrl}/challenges/${request.params.challengeId}/publish`,
        method: "POST",
        headers: request.headers,
      });

      return reply.code(response.statusCode).send(response.body);
    },
  );

  server.get<{ Params: { readonly challengeId: string } }>(
    "/challenges/:challengeId/submissions",
    async (request, reply) => {
      const response = await proxy({
        url: `${input.serviceUrls.submissionServiceUrl}/challenges/${request.params.challengeId}/submissions`,
        method: "GET",
        headers: request.headers,
      });

      return reply.code(response.statusCode).send(response.body);
    },
  );

  server.post<{ Params: { readonly challengeId: string }; Body: unknown }>(
    "/challenges/:challengeId/submissions",
    async (request, reply) => {
      const response = await proxy({
        url: `${input.serviceUrls.submissionServiceUrl}/challenges/${request.params.challengeId}/submissions`,
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
      const response = await proxy({
        url: `${input.serviceUrls.evaluationServiceUrl}/submissions/${request.params.submissionId}/evaluations`,
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
      const response = await proxy({
        url: `${input.serviceUrls.submissionServiceUrl}/submissions/${request.params.submissionId}/accept`,
        method: "POST",
        headers: request.headers,
      });

      return reply.code(response.statusCode).send(response.body);
    },
  );

  server.post<{ Params: { readonly submissionId: string } }>(
    "/submissions/:submissionId/reject",
    async (request, reply) => {
      const response = await proxy({
        url: `${input.serviceUrls.submissionServiceUrl}/submissions/${request.params.submissionId}/reject`,
        method: "POST",
        headers: request.headers,
      });

      return reply.code(response.statusCode).send(response.body);
    },
  );

  server.get("/notifications", async (request, reply) => {
    const response = await proxy({
      url: `${input.serviceUrls.notificationServiceUrl}/notifications`,
      method: "GET",
      headers: request.headers,
    });

    return reply.code(response.statusCode).send(response.body);
  });

  return server;
};

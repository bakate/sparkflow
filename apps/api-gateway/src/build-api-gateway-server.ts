import cors from "@fastify/cors";
import type {
  ActorContext,
  ChallengeDto,
  ChallengeOpportunityDto,
  SubmissionDto,
} from "@sparkflow/contracts";
import Fastify from "fastify";
import type { AccessTokenVerifier } from "./auth/access-token-verifier.ts";

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
  readonly actor: ActorContext;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly idGenerator: IdGenerator;
  readonly hasBody: boolean;
}): Headers => {
  const headers = new Headers();

  if (input.hasBody) {
    headers.set("content-type", "application/json");
  }

  headers.set(
    "x-correlation-id",
    String(input.headers["x-correlation-id"] ?? input.idGenerator.generate()),
  );
  headers.set("x-user-id", input.actor.userId);
  headers.set("x-organization-id", input.actor.organizationId);
  headers.set("x-role", input.actor.role);

  return headers;
};

const proxyJson = async (input: {
  readonly actor: ActorContext;
  readonly fetcher: Fetcher;
  readonly idGenerator: IdGenerator;
  readonly url: string;
  readonly method: "GET" | "PATCH" | "POST";
  readonly headers: Record<string, string | string[] | undefined>;
  readonly body?: unknown;
}): Promise<ServiceResponse> => {
  const headers = createForwardHeaders({
    actor: input.actor,
    headers: input.headers,
    idGenerator: input.idGenerator,
    hasBody: input.body !== undefined,
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
  readonly accessTokenVerifier: AccessTokenVerifier;
  readonly fetcher: Fetcher;
  readonly idGenerator: IdGenerator;
  readonly serviceUrls: ApiGatewayServiceUrls;
}) => {
  const server = Fastify({ logger: false });
  await server.register(cors, {
    allowedHeaders: [
      "authorization",
      "content-type",
      "x-correlation-id",
      "x-organization-id",
      "x-role",
      "x-user-id",
    ],
    methods: ["GET", "HEAD", "OPTIONS", "PATCH", "POST"],
    origin: true,
  });

  const proxy = (requestInput: {
    readonly actor: ActorContext;
    readonly url: string;
    readonly method: "GET" | "PATCH" | "POST";
    readonly headers: Record<string, string | string[] | undefined>;
    readonly body?: unknown;
  }) => {
    return proxyJson({
      fetcher: input.fetcher,
      idGenerator: input.idGenerator,
      ...requestInput,
    });
  };

  const requireOwnedChallenge = async (requestInput: {
    readonly actor: ActorContext;
    readonly challengeId: string;
    readonly headers: Record<string, string | string[] | undefined>;
  }): Promise<ServiceResponse | null> => {
    if (requestInput.actor.role !== "company-admin") {
      return { statusCode: 403, body: { error: "forbidden" } };
    }

    const challengeResponse = await proxy({
      actor: requestInput.actor,
      url: `${input.serviceUrls.challengeServiceUrl}/challenges/${requestInput.challengeId}`,
      method: "GET",
      headers: requestInput.headers,
    });

    if (challengeResponse.statusCode !== 200) {
      return challengeResponse;
    }

    if (!isChallengeDto(challengeResponse.body)) {
      return { statusCode: 502, body: { error: "unexpected-error" } };
    }

    if (challengeResponse.body.ownerOrganizationId !== requestInput.actor.organizationId) {
      return { statusCode: 403, body: { error: "forbidden" } };
    }

    return null;
  };

  const requirePublishedChallenge = async (requestInput: {
    readonly actor: ActorContext;
    readonly challengeId: string;
    readonly headers: Record<string, string | string[] | undefined>;
  }): Promise<ServiceResponse | null> => {
    const challengeResponse = await proxy({
      actor: requestInput.actor,
      url: `${input.serviceUrls.challengeServiceUrl}/challenges/${requestInput.challengeId}`,
      method: "GET",
      headers: requestInput.headers,
    });

    if (challengeResponse.statusCode !== 200) {
      return challengeResponse;
    }

    if (!isChallengeDto(challengeResponse.body)) {
      return { statusCode: 502, body: { error: "unexpected-error" } };
    }

    if (challengeResponse.body.status !== "published") {
      return { statusCode: 403, body: { error: "forbidden" } };
    }

    return null;
  };

  const requireOwnedPublishedChallenge = async (requestInput: {
    readonly actor: ActorContext;
    readonly challengeId: string;
    readonly headers: Record<string, string | string[] | undefined>;
  }): Promise<ServiceResponse | null> => {
    if (requestInput.actor.role !== "company-admin") {
      return { statusCode: 403, body: { error: "forbidden" } };
    }

    const challengeResponse = await proxy({
      actor: requestInput.actor,
      url: `${input.serviceUrls.challengeServiceUrl}/challenges/${requestInput.challengeId}`,
      method: "GET",
      headers: requestInput.headers,
    });

    if (challengeResponse.statusCode !== 200) {
      return challengeResponse;
    }

    if (!isChallengeDto(challengeResponse.body)) {
      return { statusCode: 502, body: { error: "unexpected-error" } };
    }

    if (challengeResponse.body.ownerOrganizationId !== requestInput.actor.organizationId) {
      return { statusCode: 403, body: { error: "forbidden" } };
    }

    if (challengeResponse.body.status !== "published") {
      return { statusCode: 403, body: { error: "forbidden" } };
    }

    return null;
  };

  const authenticate = async (headers: Record<string, string | string[] | undefined>) =>
    input.accessTokenVerifier.verify({
      authorizationHeader: readHeader({ headers, name: "authorization" }),
    });

  server.get("/health", async () => ({ status: "ok" }));

  server.get("/users", async (request, reply) => {
    const actor = await authenticate(request.headers);
    if (actor === null) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const response = await proxy({
      actor,
      url: `${input.serviceUrls.identityServiceUrl}/users`,
      method: "GET",
      headers: request.headers,
    });

    return reply.code(response.statusCode).send(response.body);
  });

  server.get("/challenges", async (request, reply) => {
    const actor = await authenticate(request.headers);
    if (actor === null) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const response = await proxy({
      actor,
      url: `${input.serviceUrls.challengeServiceUrl}/challenges`,
      method: "GET",
      headers: request.headers,
    });

    return reply.code(response.statusCode).send(response.body);
  });

  server.post<{ Body: unknown }>("/challenges", async (request, reply) => {
    const actor = await authenticate(request.headers);
    if (actor === null) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const response = await proxy({
      actor,
      url: `${input.serviceUrls.challengeServiceUrl}/challenges`,
      method: "POST",
      headers: request.headers,
      body: request.body,
    });

    return reply.code(response.statusCode).send(response.body);
  });

  server.patch<{ Params: { readonly challengeId: string }; Body: unknown }>(
    "/challenges/:challengeId",
    async (request, reply) => {
      const actor = await authenticate(request.headers);
      if (actor === null) {
        return reply.code(401).send({ error: "unauthorized" });
      }

      const response = await proxy({
        actor,
        url: `${input.serviceUrls.challengeServiceUrl}/challenges/${request.params.challengeId}`,
        method: "PATCH",
        headers: request.headers,
        body: request.body,
      });

      return reply.code(response.statusCode).send(response.body);
    },
  );

  server.post<{ Params: { readonly challengeId: string } }>(
    "/challenges/:challengeId/archive",
    async (request, reply) => {
      const actor = await authenticate(request.headers);
      if (actor === null) {
        return reply.code(401).send({ error: "unauthorized" });
      }

      const response = await proxy({
        actor,
        url: `${input.serviceUrls.challengeServiceUrl}/challenges/${request.params.challengeId}/archive`,
        method: "POST",
        headers: request.headers,
      });

      return reply.code(response.statusCode).send(response.body);
    },
  );

  server.post<{ Params: { readonly challengeId: string } }>(
    "/challenges/:challengeId/publish",
    async (request, reply) => {
      const actor = await authenticate(request.headers);
      if (actor === null) {
        return reply.code(401).send({ error: "unauthorized" });
      }

      const response = await proxy({
        actor,
        url: `${input.serviceUrls.challengeServiceUrl}/challenges/${request.params.challengeId}/publish`,
        method: "POST",
        headers: request.headers,
      });

      return reply.code(response.statusCode).send(response.body);
    },
  );

  server.post<{ Params: { readonly challengeId: string } }>(
    "/challenges/:challengeId/draft",
    async (request, reply) => {
      const actor = await authenticate(request.headers);
      if (actor === null) {
        return reply.code(401).send({ error: "unauthorized" });
      }

      const response = await proxy({
        actor,
        url: `${input.serviceUrls.challengeServiceUrl}/challenges/${request.params.challengeId}/draft`,
        method: "POST",
        headers: request.headers,
      });

      return reply.code(response.statusCode).send(response.body);
    },
  );

  server.get<{ Params: { readonly challengeId: string } }>(
    "/challenges/:challengeId/submissions",
    async (request, reply) => {
      const actor = await authenticate(request.headers);
      if (actor === null) {
        return reply.code(401).send({ error: "unauthorized" });
      }

      const guardResponse = await requireOwnedChallenge({
        actor,
        challengeId: request.params.challengeId,
        headers: request.headers,
      });

      if (guardResponse !== null) {
        return reply.code(guardResponse.statusCode).send(guardResponse.body);
      }

      const response = await proxy({
        actor,
        url: `${input.serviceUrls.submissionServiceUrl}/challenges/${request.params.challengeId}/submissions`,
        method: "GET",
        headers: request.headers,
      });

      return reply.code(response.statusCode).send(response.body);
    },
  );

  server.get("/me/submissions", async (request, reply) => {
    const actor = await authenticate(request.headers);
    if (actor === null) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const response = await proxy({
      actor,
      url: `${input.serviceUrls.submissionServiceUrl}/me/submissions`,
      method: "GET",
      headers: request.headers,
    });

    return reply.code(response.statusCode).send(response.body);
  });

  server.get("/me/opportunities", async (request, reply) => {
    const actor = await authenticate(request.headers);
    if (actor === null) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    if (actor.role !== "startup-member") {
      return reply.code(403).send({ error: "forbidden" });
    }

    const submissionsResponse = await proxy({
      actor,
      url: `${input.serviceUrls.submissionServiceUrl}/me/submissions`,
      method: "GET",
      headers: request.headers,
    });

    if (submissionsResponse.statusCode !== 200) {
      return reply.code(submissionsResponse.statusCode).send(submissionsResponse.body);
    }

    if (!isSubmissionDtoArray(submissionsResponse.body)) {
      return reply.code(502).send({ error: "unexpected-error" });
    }

    const opportunities: ChallengeOpportunityDto[] = [];
    const challengeById = new Map<string, ChallengeDto>();

    for (const submission of submissionsResponse.body) {
      const cachedChallenge = challengeById.get(submission.challengeId);

      if (cachedChallenge !== undefined) {
        opportunities.push({ challenge: cachedChallenge, submission });
        continue;
      }

      const challengeResponse = await proxy({
        actor,
        url: `${input.serviceUrls.challengeServiceUrl}/challenges/${submission.challengeId}`,
        method: "GET",
        headers: request.headers,
      });

      if (challengeResponse.statusCode !== 200) {
        return reply.code(challengeResponse.statusCode).send(challengeResponse.body);
      }

      if (!isChallengeDto(challengeResponse.body)) {
        return reply.code(502).send({ error: "unexpected-error" });
      }

      challengeById.set(submission.challengeId, challengeResponse.body);
      opportunities.push({ challenge: challengeResponse.body, submission });
    }

    return reply.send(opportunities);
  });

  server.post<{ Params: { readonly challengeId: string }; Body: unknown }>(
    "/challenges/:challengeId/submissions",
    async (request, reply) => {
      const actor = await authenticate(request.headers);
      if (actor === null) {
        return reply.code(401).send({ error: "unauthorized" });
      }

      const guardResponse = await requirePublishedChallenge({
        actor,
        challengeId: request.params.challengeId,
        headers: request.headers,
      });

      if (guardResponse !== null) {
        return reply.code(guardResponse.statusCode).send(guardResponse.body);
      }

      const response = await proxy({
        actor,
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
      const actor = await authenticate(request.headers);
      if (actor === null) {
        return reply.code(401).send({ error: "unauthorized" });
      }

      const response = await proxy({
        actor,
        url: `${input.serviceUrls.evaluationServiceUrl}/submissions/${request.params.submissionId}/evaluations`,
        method: "POST",
        headers: request.headers,
        body: request.body,
      });

      return reply.code(response.statusCode).send(response.body);
    },
  );

  server.post<{ Params: { readonly challengeId: string; readonly submissionId: string } }>(
    "/challenges/:challengeId/submissions/:submissionId/accept",
    async (request, reply) => {
      const actor = await authenticate(request.headers);
      if (actor === null) {
        return reply.code(401).send({ error: "unauthorized" });
      }

      const guardResponse = await requireOwnedPublishedChallenge({
        actor,
        challengeId: request.params.challengeId,
        headers: request.headers,
      });

      if (guardResponse !== null) {
        return reply.code(guardResponse.statusCode).send(guardResponse.body);
      }

      const response = await proxy({
        actor,
        url: `${input.serviceUrls.submissionServiceUrl}/submissions/${request.params.submissionId}/accept`,
        method: "POST",
        headers: request.headers,
      });

      return reply.code(response.statusCode).send(response.body);
    },
  );

  server.post<{ Params: { readonly challengeId: string; readonly submissionId: string } }>(
    "/challenges/:challengeId/submissions/:submissionId/reject",
    async (request, reply) => {
      const actor = await authenticate(request.headers);
      if (actor === null) {
        return reply.code(401).send({ error: "unauthorized" });
      }

      const guardResponse = await requireOwnedPublishedChallenge({
        actor,
        challengeId: request.params.challengeId,
        headers: request.headers,
      });

      if (guardResponse !== null) {
        return reply.code(guardResponse.statusCode).send(guardResponse.body);
      }

      const response = await proxy({
        actor,
        url: `${input.serviceUrls.submissionServiceUrl}/submissions/${request.params.submissionId}/reject`,
        method: "POST",
        headers: request.headers,
      });

      return reply.code(response.statusCode).send(response.body);
    },
  );

  server.post<{ Params: { readonly challengeId: string; readonly submissionId: string } }>(
    "/challenges/:challengeId/submissions/:submissionId/select",
    async (request, reply) => {
      const actor = await authenticate(request.headers);
      if (actor === null) {
        return reply.code(401).send({ error: "unauthorized" });
      }

      const guardResponse = await requireOwnedPublishedChallenge({
        actor,
        challengeId: request.params.challengeId,
        headers: request.headers,
      });

      if (guardResponse !== null) {
        return reply.code(guardResponse.statusCode).send(guardResponse.body);
      }

      const response = await proxy({
        actor,
        url: `${input.serviceUrls.submissionServiceUrl}/submissions/${request.params.submissionId}/select`,
        method: "POST",
        headers: request.headers,
      });

      return reply.code(response.statusCode).send(response.body);
    },
  );

  server.get("/notifications", async (request, reply) => {
    const actor = await authenticate(request.headers);
    if (actor === null) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const response = await proxy({
      actor,
      url: `${input.serviceUrls.notificationServiceUrl}/notifications`,
      method: "GET",
      headers: request.headers,
    });

    return reply.code(response.statusCode).send(response.body);
  });

  return server;
};

const readHeader = (input: {
  readonly headers: Record<string, string | string[] | undefined>;
  readonly name: string;
}): string | undefined => {
  const value = input.headers[input.name];

  return Array.isArray(value) ? value[0] : value;
};

const isChallengeDto = (value: unknown): value is ChallengeDto => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  if (!("id" in value) || !("ownerOrganizationId" in value) || !("status" in value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.ownerOrganizationId === "string" &&
    typeof value.status === "string"
  );
};

const isSubmissionDtoArray = (value: unknown): value is SubmissionDto[] =>
  Array.isArray(value) && value.every(isSubmissionDto);

const isSubmissionDto = (value: unknown): value is SubmissionDto => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  if (!("id" in value) || !("challengeId" in value) || !("startupOrganizationId" in value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.challengeId === "string" &&
    typeof value.startupOrganizationId === "string"
  );
};

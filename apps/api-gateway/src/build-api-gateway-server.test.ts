import { faker } from "@faker-js/faker";
import type { ActorContext } from "@sparkflow/contracts";
import { afterEach, describe, expect, it } from "vitest";
import type { AccessTokenVerifier } from "./auth/access-token-verifier.js";
import { buildApiGatewayServer } from "./build-api-gateway-server.js";

type CapturedRequest = {
  readonly url: string;
  readonly init: RequestInit;
};

const serviceUrls = {
  identityServiceUrl: "http://identity-service",
  challengeServiceUrl: "http://challenge-service",
  submissionServiceUrl: "http://submission-service",
  notificationServiceUrl: "http://notification-service",
  evaluationServiceUrl: "http://evaluation-service",
} as const;

const openServers: { readonly close: () => Promise<void> }[] = [];
const companyAdminActor: ActorContext = {
  organizationId: "org-company",
  role: "company-admin",
  userId: "user-company-admin",
};
const startupMemberActor: ActorContext = {
  organizationId: "org-startup",
  role: "startup-member",
  userId: "user-startup",
};
const authorizationHeader = "Bearer valid-token";

const readCapturedRequest = (input: {
  readonly requests: readonly CapturedRequest[];
  readonly index?: number;
}): CapturedRequest => {
  const request = input.requests[input.index ?? 0];

  if (request === undefined) {
    expect.fail("Missing captured request");
  }

  return request;
};

const readForwardedHeaders = (input: { readonly request: CapturedRequest }): Headers => {
  const headers = input.request.init.headers;

  if (!(headers instanceof Headers)) {
    expect.fail("Expected forwarded headers to be a Headers instance");
  }

  return headers;
};

const createServerWithCapturedRequests = async () => {
  const requests: CapturedRequest[] = [];
  const server = await buildApiGatewayServer({
    accessTokenVerifier: createAccessTokenVerifier({ actor: companyAdminActor }),
    serviceUrls,
    idGenerator: { generate: () => "generated-correlation-id" },
    fetcher: async (url, init) => {
      requests.push({ url, init });

      return new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    },
  });

  openServers.push(server);

  return { requests, server };
};

const createWorkflowServer = async (input: {
  readonly challengeId: string;
  readonly submissionId: string;
}) => {
  const requests: CapturedRequest[] = [];
  const server = await buildApiGatewayServer({
    accessTokenVerifier: createAccessTokenVerifier({ actor: companyAdminActor }),
    serviceUrls,
    idGenerator: { generate: () => faker.string.uuid() },
    fetcher: async (url, init) => {
      requests.push({ url, init });

      if (url.endsWith("/challenges") && init.method === "POST") {
        return Response.json({ id: input.challengeId, status: "draft" }, { status: 201 });
      }

      if (url.endsWith(`/challenges/${input.challengeId}`) && init.method === "PATCH") {
        return Response.json({ id: input.challengeId, status: "draft" });
      }

      if (url.endsWith(`/challenges/${input.challengeId}`) && init.method === "GET") {
        return Response.json({
          id: input.challengeId,
          ownerOrganizationId: companyAdminActor.organizationId,
          status: "published",
        });
      }

      if (url.endsWith(`/challenges/${input.challengeId}/publish`)) {
        return Response.json({ id: input.challengeId, status: "published" });
      }

      if (url.endsWith(`/challenges/${input.challengeId}/draft`)) {
        return Response.json({ id: input.challengeId, status: "draft" });
      }

      if (url.endsWith(`/challenges/${input.challengeId}/submissions`) && init.method === "POST") {
        return Response.json({ id: input.submissionId, status: "submitted" }, { status: 201 });
      }

      if (url.endsWith("/me/submissions")) {
        return Response.json([{ id: input.submissionId, status: "submitted" }]);
      }

      if (url.endsWith(`/submissions/${input.submissionId}/evaluations`)) {
        return Response.json({ submissionId: input.submissionId, score: 91 }, { status: 201 });
      }

      if (url.endsWith(`/submissions/${input.submissionId}/accept`)) {
        return Response.json({ id: input.submissionId, status: "accepted" });
      }

      if (url.endsWith(`/submissions/${input.submissionId}/select`)) {
        return Response.json({ id: input.submissionId, status: "selected" });
      }

      if (url.endsWith("/notifications")) {
        return Response.json([{ eventId: faker.string.uuid(), title: "Submission accepted" }]);
      }

      return Response.json([]);
    },
  });

  openServers.push(server);

  return { requests, server };
};

const createAccessTokenVerifier = (input: {
  readonly actor: ActorContext | null;
}): AccessTokenVerifier => ({
  verify: async ({ authorizationHeader: currentAuthorizationHeader }) =>
    currentAuthorizationHeader === authorizationHeader ? input.actor : null,
});

const readJsonBody = (input: { readonly request: CapturedRequest }): unknown => {
  const body = input.request.init.body;

  if (typeof body !== "string") {
    expect.fail("Expected request body to be a JSON string");
  }

  return JSON.parse(body) as unknown;
};

afterEach(async () => {
  const serversToClose = [...openServers];
  openServers.length = 0;

  await Promise.all(serversToClose.map((server) => server.close()));
});

describe("buildApiGatewayServer", () => {
  it("returns health without proxying to another service", async () => {
    const { requests, server } = await createServerWithCapturedRequests();

    const response = await server.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
    expect(requests).toEqual([]);
  });

  it("rejects requests without a valid access token", async () => {
    const { requests, server } = await createServerWithCapturedRequests();

    const response = await server.inject({
      method: "GET",
      url: "/challenges",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "unauthorized" });
    expect(requests).toEqual([]);
  });

  it("proxies challenge listing with generated correlation and authenticated actor headers", async () => {
    const { requests, server } = await createServerWithCapturedRequests();

    const response = await server.inject({
      method: "GET",
      url: "/challenges",
      headers: {
        authorization: authorizationHeader,
      },
    });

    const request = readCapturedRequest({ requests });
    const headers = readForwardedHeaders({ request });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ ok: true });
    expect(request.url).toBe("http://challenge-service/challenges");
    expect(request.init.method).toBe("GET");
    expect(headers.get("content-type")).toBeNull();
    expect(headers.get("x-correlation-id")).toBe("generated-correlation-id");
    expect(headers.get("x-user-id")).toBe("user-company-admin");
    expect(headers.get("x-organization-id")).toBe("org-company");
    expect(headers.get("x-role")).toBe("company-admin");
  });

  it("proxies challenge draft transition", async () => {
    const { requests, server } = await createServerWithCapturedRequests();

    await server.inject({
      method: "POST",
      url: "/challenges/challenge-1/draft",
      headers: {
        authorization: authorizationHeader,
      },
    });

    const request = readCapturedRequest({ requests });

    expect(request.url).toBe("http://challenge-service/challenges/challenge-1/draft");
    expect(request.init.method).toBe("POST");
    expect(request.init.body).toBeUndefined();
  });

  it("allows PATCH preflight requests", async () => {
    const { server } = await createServerWithCapturedRequests();

    const response = await server.inject({
      method: "OPTIONS",
      url: "/challenges/challenge-1",
      headers: {
        "access-control-request-headers": "content-type",
        "access-control-request-method": "PATCH",
        origin: "http://127.0.0.1:4200",
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-methods"]).toContain("PATCH");
  });

  it("proxies submission creation with body and authenticated actor headers", async () => {
    const requests: CapturedRequest[] = [];
    const server = await buildApiGatewayServer({
      accessTokenVerifier: createAccessTokenVerifier({ actor: companyAdminActor }),
      serviceUrls,
      idGenerator: { generate: () => "generated-correlation-id" },
      fetcher: async (url, init) => {
        requests.push({ url, init });

        if (url.endsWith("/challenges/challenge-1") && init.method === "GET") {
          return Response.json({
            id: "challenge-1",
            ownerOrganizationId: "org-company",
            status: "published",
          });
        }

        return Response.json({ id: "submission-1", status: "submitted" }, { status: 201 });
      },
    });
    openServers.push(server);

    await server.inject({
      method: "POST",
      url: "/challenges/challenge-1/submissions",
      headers: {
        authorization: authorizationHeader,
        "x-correlation-id": "incoming-correlation-id",
        "x-user-id": "startup-user",
        "x-organization-id": "startup-org",
        "x-role": "startup-member",
      },
      payload: {
        summary: "A strong proposal",
      },
    });

    const request = readCapturedRequest({ requests, index: 1 });
    const headers = readForwardedHeaders({ request });

    expect(
      requests.map((capturedRequest) => `${capturedRequest.init.method} ${capturedRequest.url}`),
    ).toEqual([
      "GET http://challenge-service/challenges/challenge-1",
      "POST http://submission-service/challenges/challenge-1/submissions",
    ]);
    expect(request.url).toBe("http://submission-service/challenges/challenge-1/submissions");
    expect(request.init.method).toBe("POST");
    expect(request.init.body).toBe(JSON.stringify({ summary: "A strong proposal" }));
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("x-correlation-id")).toBe("incoming-correlation-id");
    expect(headers.get("x-user-id")).toBe("user-company-admin");
    expect(headers.get("x-organization-id")).toBe("org-company");
    expect(headers.get("x-role")).toBe("company-admin");
  });

  it("rejects submission creation when the challenge is archived", async () => {
    const requests: CapturedRequest[] = [];
    const server = await buildApiGatewayServer({
      accessTokenVerifier: createAccessTokenVerifier({ actor: companyAdminActor }),
      serviceUrls,
      idGenerator: { generate: () => "generated-correlation-id" },
      fetcher: async (url, init) => {
        requests.push({ url, init });

        return Response.json({
          id: "challenge-1",
          ownerOrganizationId: "org-company",
          status: "archived",
        });
      },
    });
    openServers.push(server);

    const response = await server.inject({
      method: "POST",
      url: "/challenges/challenge-1/submissions",
      headers: {
        authorization: authorizationHeader,
      },
      payload: {
        summary: "A late proposal",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "forbidden" });
    expect(requests.map((request) => `${request.init.method} ${request.url}`)).toEqual([
      "GET http://challenge-service/challenges/challenge-1",
    ]);
  });

  it("routes evaluation submission to the Python evaluation service", async () => {
    const { requests, server } = await createServerWithCapturedRequests();

    await server.inject({
      method: "POST",
      url: "/submissions/submission-1/evaluations",
      payload: {
        score: 88,
        recommendation: "accept",
      },
      headers: {
        authorization: authorizationHeader,
      },
    });

    const request = readCapturedRequest({ requests });

    expect(request.url).toBe("http://evaluation-service/submissions/submission-1/evaluations");
    expect(request.init.method).toBe("POST");
    expect(request.init.body).toBe(
      JSON.stringify({
        score: 88,
        recommendation: "accept",
      }),
    );
  });

  it("builds startup opportunities from my submissions and challenge details", async () => {
    const requests: CapturedRequest[] = [];
    const server = await buildApiGatewayServer({
      accessTokenVerifier: createAccessTokenVerifier({ actor: startupMemberActor }),
      serviceUrls,
      idGenerator: { generate: () => "generated-correlation-id" },
      fetcher: async (url, init) => {
        requests.push({ url, init });

        if (url.endsWith("/me/submissions")) {
          return Response.json([
            {
              id: "submission-1",
              challengeId: "challenge-1",
              startupOrganizationId: startupMemberActor.organizationId,
              summary: "A serious proposal.",
              status: "selected",
              createdAt: "2026-06-22T10:00:00.000Z",
              decidedAt: "2026-06-22T12:00:00.000Z",
            },
          ]);
        }

        return Response.json({
          id: "challenge-1",
          title: "Completed challenge",
          description: "Challenge description",
          ownerOrganizationId: "org-company",
          status: "selection-completed",
          createdAt: "2026-06-21T10:00:00.000Z",
          publishedAt: "2026-06-21T11:00:00.000Z",
        });
      },
    });
    openServers.push(server);

    const response = await server.inject({
      method: "GET",
      url: "/me/opportunities",
      headers: {
        authorization: authorizationHeader,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      {
        challenge: {
          id: "challenge-1",
          title: "Completed challenge",
          description: "Challenge description",
          ownerOrganizationId: "org-company",
          status: "selection-completed",
          createdAt: "2026-06-21T10:00:00.000Z",
          publishedAt: "2026-06-21T11:00:00.000Z",
        },
        submission: {
          id: "submission-1",
          challengeId: "challenge-1",
          startupOrganizationId: startupMemberActor.organizationId,
          summary: "A serious proposal.",
          status: "selected",
          createdAt: "2026-06-22T10:00:00.000Z",
          decidedAt: "2026-06-22T12:00:00.000Z",
        },
      },
    ]);
    expect(requests.map((request) => `${request.init.method} ${request.url}`)).toEqual([
      "GET http://submission-service/me/submissions",
      "GET http://challenge-service/challenges/challenge-1",
    ]);
  });

  it("rejects company actors from startup opportunities", async () => {
    const { requests, server } = await createServerWithCapturedRequests();

    const response = await server.inject({
      method: "GET",
      url: "/me/opportunities",
      headers: {
        authorization: authorizationHeader,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "forbidden" });
    expect(requests).toEqual([]);
  });

  it("rejects submission review when the company does not own the challenge", async () => {
    const requests: CapturedRequest[] = [];
    const server = await buildApiGatewayServer({
      accessTokenVerifier: createAccessTokenVerifier({
        actor: { ...companyAdminActor, organizationId: "org-other-company" },
      }),
      serviceUrls,
      idGenerator: { generate: () => "generated-correlation-id" },
      fetcher: async (url, init) => {
        requests.push({ url, init });

        return Response.json({
          id: "challenge-1",
          ownerOrganizationId: "org-company",
          status: "published",
        });
      },
    });
    openServers.push(server);

    const response = await server.inject({
      method: "GET",
      url: "/challenges/challenge-1/submissions",
      headers: {
        authorization: authorizationHeader,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "forbidden" });
    expect(requests.map((request) => `${request.init.method} ${request.url}`)).toEqual([
      "GET http://challenge-service/challenges/challenge-1",
    ]);
  });

  it("allows readonly submission review after challenge selection is completed", async () => {
    const requests: CapturedRequest[] = [];
    const server = await buildApiGatewayServer({
      accessTokenVerifier: createAccessTokenVerifier({ actor: companyAdminActor }),
      serviceUrls,
      idGenerator: { generate: () => "generated-correlation-id" },
      fetcher: async (url, init) => {
        requests.push({ url, init });

        if (url.endsWith("/challenges/challenge-1") && init.method === "GET") {
          return Response.json({
            id: "challenge-1",
            ownerOrganizationId: companyAdminActor.organizationId,
            status: "selection-completed",
          });
        }

        return Response.json([{ id: "submission-1", status: "selected" }]);
      },
    });
    openServers.push(server);

    const response = await server.inject({
      method: "GET",
      url: "/challenges/challenge-1/submissions",
      headers: {
        authorization: authorizationHeader,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([{ id: "submission-1", status: "selected" }]);
    expect(requests.map((request) => `${request.init.method} ${request.url}`)).toEqual([
      "GET http://challenge-service/challenges/challenge-1",
      "GET http://submission-service/challenges/challenge-1/submissions",
    ]);
  });

  it.each([
    ["accept", "accept"],
    ["reject", "reject"],
    ["select", "select"],
  ] as const)(
    "rejects submission %s after challenge selection is completed",
    async (_label, decisionPath) => {
      const requests: CapturedRequest[] = [];
      const server = await buildApiGatewayServer({
        accessTokenVerifier: createAccessTokenVerifier({ actor: companyAdminActor }),
        serviceUrls,
        idGenerator: { generate: () => "generated-correlation-id" },
        fetcher: async (url, init) => {
          requests.push({ url, init });

          return Response.json({
            id: "challenge-1",
            ownerOrganizationId: companyAdminActor.organizationId,
            status: "selection-completed",
          });
        },
      });
      openServers.push(server);

      const response = await server.inject({
        method: "POST",
        url: `/challenges/challenge-1/submissions/submission-1/${decisionPath}`,
        headers: {
          authorization: authorizationHeader,
        },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ error: "forbidden" });
      expect(requests.map((request) => `${request.init.method} ${request.url}`)).toEqual([
        "GET http://challenge-service/challenges/challenge-1",
      ]);
    },
  );

  it("supports the V1 backend workflow through public gateway endpoints", async () => {
    const challengeId = faker.string.uuid();
    const submissionId = faker.string.uuid();
    const challengeTitle = faker.company.catchPhrase();
    const challengeDescription = faker.lorem.paragraph();
    const proposalSummary = faker.lorem.paragraph();
    const reviewComment = faker.lorem.sentence();
    const correlationId = faker.string.uuid();
    const { requests, server } = await createWorkflowServer({ challengeId, submissionId });

    await server.inject({
      method: "POST",
      url: "/challenges",
      headers: {
        authorization: authorizationHeader,
        "x-correlation-id": correlationId,
        "x-user-id": faker.string.uuid(),
        "x-organization-id": "org-company",
        "x-role": "company-admin",
      },
      payload: { title: challengeTitle, description: challengeDescription },
    });
    await server.inject({
      method: "PATCH",
      url: `/challenges/${challengeId}`,
      headers: {
        authorization: authorizationHeader,
      },
      payload: { title: `${challengeTitle} updated`, description: challengeDescription },
    });
    await server.inject({
      method: "POST",
      url: `/challenges/${challengeId}/publish`,
      headers: {
        authorization: authorizationHeader,
      },
    });
    await server.inject({
      method: "GET",
      url: "/challenges",
      headers: {
        authorization: authorizationHeader,
      },
    });
    await server.inject({
      method: "POST",
      url: `/challenges/${challengeId}/submissions`,
      headers: {
        authorization: authorizationHeader,
        "x-user-id": faker.string.uuid(),
        "x-organization-id": "org-startup",
        "x-role": "startup-member",
      },
      payload: { summary: proposalSummary },
    });
    await server.inject({
      method: "GET",
      url: `/challenges/${challengeId}/submissions`,
      headers: {
        authorization: authorizationHeader,
      },
    });
    await server.inject({
      method: "GET",
      url: "/me/submissions",
      headers: {
        authorization: authorizationHeader,
      },
    });
    await server.inject({
      method: "POST",
      url: `/submissions/${submissionId}/evaluations`,
      headers: {
        authorization: authorizationHeader,
        "x-user-id": faker.string.uuid(),
        "x-organization-id": "org-reviewer",
        "x-role": "reviewer",
      },
      payload: { score: 91, comment: reviewComment },
    });
    await server.inject({
      method: "POST",
      url: `/challenges/${challengeId}/submissions/${submissionId}/accept`,
      headers: {
        authorization: authorizationHeader,
      },
    });
    await server.inject({
      method: "POST",
      url: `/challenges/${challengeId}/submissions/${submissionId}/select`,
      headers: {
        authorization: authorizationHeader,
      },
    });
    await server.inject({
      method: "GET",
      url: "/notifications",
      headers: { authorization: authorizationHeader, "x-organization-id": "org-startup" },
    });

    expect(requests.map((request) => `${request.init.method} ${request.url}`)).toEqual([
      "POST http://challenge-service/challenges",
      `PATCH http://challenge-service/challenges/${challengeId}`,
      `POST http://challenge-service/challenges/${challengeId}/publish`,
      "GET http://challenge-service/challenges",
      `GET http://challenge-service/challenges/${challengeId}`,
      `POST http://submission-service/challenges/${challengeId}/submissions`,
      `GET http://challenge-service/challenges/${challengeId}`,
      `GET http://submission-service/challenges/${challengeId}/submissions`,
      "GET http://submission-service/me/submissions",
      `POST http://evaluation-service/submissions/${submissionId}/evaluations`,
      `GET http://challenge-service/challenges/${challengeId}`,
      `POST http://submission-service/submissions/${submissionId}/accept`,
      `GET http://challenge-service/challenges/${challengeId}`,
      `POST http://submission-service/submissions/${submissionId}/select`,
      "GET http://notification-service/notifications",
    ]);
    expect(readJsonBody({ request: readCapturedRequest({ requests, index: 0 }) })).toEqual({
      title: challengeTitle,
      description: challengeDescription,
    });
    expect(readJsonBody({ request: readCapturedRequest({ requests, index: 1 }) })).toEqual({
      title: `${challengeTitle} updated`,
      description: challengeDescription,
    });
    expect(readJsonBody({ request: readCapturedRequest({ requests, index: 5 }) })).toEqual({
      summary: proposalSummary,
    });
    expect(readJsonBody({ request: readCapturedRequest({ requests, index: 9 }) })).toEqual({
      score: 91,
      comment: reviewComment,
    });
    expect(readCapturedRequest({ requests, index: 2 }).init.body).toBeUndefined();
    expect(
      readForwardedHeaders({ request: readCapturedRequest({ requests, index: 2 }) }).get(
        "content-type",
      ),
    ).toBeNull();
    expect(readCapturedRequest({ requests, index: 11 }).init.body).toBeUndefined();
    expect(
      readForwardedHeaders({ request: readCapturedRequest({ requests, index: 11 }) }).get(
        "content-type",
      ),
    ).toBeNull();
  });
});

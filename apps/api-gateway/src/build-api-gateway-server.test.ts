import { faker } from "@faker-js/faker";
import { afterEach, describe, expect, it } from "vitest";
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

      if (url.endsWith(`/challenges/${input.challengeId}/publish`)) {
        return Response.json({ id: input.challengeId, status: "published" });
      }

      if (url.endsWith(`/challenges/${input.challengeId}/submissions`) && init.method === "POST") {
        return Response.json({ id: input.submissionId, status: "submitted" }, { status: 201 });
      }

      if (url.endsWith(`/submissions/${input.submissionId}/evaluations`)) {
        return Response.json({ submissionId: input.submissionId, score: 91 }, { status: 201 });
      }

      if (url.endsWith(`/submissions/${input.submissionId}/accept`)) {
        return Response.json({ id: input.submissionId, status: "accepted" });
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

  it("proxies challenge listing with generated correlation and default fake auth headers", async () => {
    const { requests, server } = await createServerWithCapturedRequests();

    const response = await server.inject({
      method: "GET",
      url: "/challenges",
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

  it("proxies submission creation with body and preserves incoming auth headers", async () => {
    const { requests, server } = await createServerWithCapturedRequests();

    await server.inject({
      method: "POST",
      url: "/challenges/challenge-1/submissions",
      headers: {
        "x-correlation-id": "incoming-correlation-id",
        "x-user-id": "startup-user",
        "x-organization-id": "startup-org",
        "x-role": "startup-member",
      },
      payload: {
        summary: "A strong proposal",
      },
    });

    const request = readCapturedRequest({ requests });
    const headers = readForwardedHeaders({ request });

    expect(request.url).toBe("http://submission-service/challenges/challenge-1/submissions");
    expect(request.init.method).toBe("POST");
    expect(request.init.body).toBe(JSON.stringify({ summary: "A strong proposal" }));
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("x-correlation-id")).toBe("incoming-correlation-id");
    expect(headers.get("x-user-id")).toBe("startup-user");
    expect(headers.get("x-organization-id")).toBe("startup-org");
    expect(headers.get("x-role")).toBe("startup-member");
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
      payload: { title: `${challengeTitle} updated`, description: challengeDescription },
    });
    await server.inject({ method: "POST", url: `/challenges/${challengeId}/publish` });
    await server.inject({ method: "GET", url: "/challenges" });
    await server.inject({
      method: "POST",
      url: `/challenges/${challengeId}/submissions`,
      headers: {
        "x-user-id": faker.string.uuid(),
        "x-organization-id": "org-startup",
        "x-role": "startup-member",
      },
      payload: { summary: proposalSummary },
    });
    await server.inject({ method: "GET", url: `/challenges/${challengeId}/submissions` });
    await server.inject({
      method: "POST",
      url: `/submissions/${submissionId}/evaluations`,
      headers: {
        "x-user-id": faker.string.uuid(),
        "x-organization-id": "org-reviewer",
        "x-role": "reviewer",
      },
      payload: { score: 91, comment: reviewComment },
    });
    await server.inject({ method: "POST", url: `/submissions/${submissionId}/accept` });
    await server.inject({
      method: "GET",
      url: "/notifications",
      headers: { "x-organization-id": "org-startup" },
    });

    expect(requests.map((request) => `${request.init.method} ${request.url}`)).toEqual([
      "POST http://challenge-service/challenges",
      `PATCH http://challenge-service/challenges/${challengeId}`,
      `POST http://challenge-service/challenges/${challengeId}/publish`,
      "GET http://challenge-service/challenges",
      `POST http://submission-service/challenges/${challengeId}/submissions`,
      `GET http://submission-service/challenges/${challengeId}/submissions`,
      `POST http://evaluation-service/submissions/${submissionId}/evaluations`,
      `POST http://submission-service/submissions/${submissionId}/accept`,
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
    expect(readJsonBody({ request: readCapturedRequest({ requests, index: 4 }) })).toEqual({
      summary: proposalSummary,
    });
    expect(readJsonBody({ request: readCapturedRequest({ requests, index: 6 }) })).toEqual({
      score: 91,
      comment: reviewComment,
    });
    expect(readCapturedRequest({ requests, index: 2 }).init.body).toBeUndefined();
    expect(
      readForwardedHeaders({ request: readCapturedRequest({ requests, index: 2 }) }).get(
        "content-type",
      ),
    ).toBeNull();
    expect(readCapturedRequest({ requests, index: 7 }).init.body).toBeUndefined();
    expect(
      readForwardedHeaders({ request: readCapturedRequest({ requests, index: 7 }) }).get(
        "content-type",
      ),
    ).toBeNull();
  });
});

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
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("x-correlation-id")).toBe("generated-correlation-id");
    expect(headers.get("x-user-id")).toBe("user-company-admin");
    expect(headers.get("x-organization-id")).toBe("org-company");
    expect(headers.get("x-role")).toBe("company-admin");
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
});

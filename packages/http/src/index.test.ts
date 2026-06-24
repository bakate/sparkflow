import { describe, expect, it } from "vitest";
import { readActor, readCorrelationId, readPagination } from "./index.js";

describe("HTTP header readers", () => {
  it("reads actor headers", () => {
    const actor = readActor({
      headers: {
        "x-organization-id": "org-company",
        "x-role": "company-admin",
        "x-user-email": "company-admin@sparkflow.test",
        "x-user-id": "user-company-admin",
      },
    });

    expect(actor).toEqual({
      organizationId: "org-company",
      role: "company-admin",
      userEmail: "company-admin@sparkflow.test",
      userId: "user-company-admin",
    });
  });

  it("falls back to anonymous startup member actor", () => {
    const actor = readActor({ headers: {} });

    expect(actor).toEqual({
      organizationId: "unknown-organization",
      role: "startup-member",
      userEmail: null,
      userId: "anonymous",
    });
  });

  it("reads correlation id headers", () => {
    const correlationId = readCorrelationId({
      headers: {
        "x-correlation-id": "correlation-1",
      },
    });

    expect(correlationId).toBe("correlation-1");
  });

  it("reads cursor pagination query values", () => {
    const page = readPagination({
      query: {
        cursor: "2b6c2fed-89d4-4f9b-9cbf-c6d5da96af58",
        limit: "50",
      },
    });

    expect(page).toEqual({
      ok: true,
      value: {
        cursor: "2b6c2fed-89d4-4f9b-9cbf-c6d5da96af58",
        limit: 50,
      },
    });
  });

  it("rejects invalid cursor pagination query values", () => {
    const page = readPagination({
      query: {
        cursor: "not-a-cursor",
      },
    });

    expect(page).toEqual({ ok: false, error: "invalid-pagination" });
  });
});

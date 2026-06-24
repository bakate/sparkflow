import { describe, expect, it } from "vitest";
import { readActor, readCorrelationId } from "./index.js";

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
});

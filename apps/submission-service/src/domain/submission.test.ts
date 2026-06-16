import { fc, test } from "@fast-check/vitest";
import { describe, expect } from "vitest";
import { createSubmission } from "./submission.ts";

const fixedCreatedAt = new Date("2026-06-16T10:00:00.000Z");

describe("Submission domain", () => {
  test.prop([fcNonEmptyTrimmedString()])("trims non-empty summaries", (summary) => {
    const submission = createSubmission({
      id: "submission-id",
      challengeId: "challenge-id",
      startupOrganizationId: "startup-organization-id",
      summary: `  ${summary}  `,
      now: fixedCreatedAt,
    });

    expect(submission.summary).toBe(summary);
    expect(submission.status).toBe("submitted");
    expect(submission.decidedAt).toBeNull();
  });
});

function fcNonEmptyTrimmedString() {
  return fc
    .string({ minLength: 1 })
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

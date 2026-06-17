import { Pool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Submission } from "../domain/submission.ts";
import {
  createPostgresSubmissionRepository,
  ensureSubmissionSchema,
} from "./postgres-submission-repository.ts";

const testDatabaseUrl = process.env.SUBMISSION_SERVICE_TEST_DATABASE_URL;
const shouldRunIntegrationTests =
  testDatabaseUrl !== undefined && testDatabaseUrl.trim().length > 0;

const challengeId = "11111111-1111-4111-8111-111111111111";
const otherChallengeId = "22222222-2222-4222-8222-222222222222";

const createSubmittedSubmission = (input: {
  readonly id: string;
  readonly challengeId: string;
  readonly createdAt: Date;
  readonly summary?: string;
}): Submission => ({
  id: input.id,
  challengeId: input.challengeId,
  startupOrganizationId: "org-startup",
  summary: input.summary ?? "Bio-based packaging solution.",
  status: "submitted",
  createdAt: input.createdAt,
  decidedAt: null,
});

const requireTestDatabaseUrl = (): string => {
  if (testDatabaseUrl === undefined || testDatabaseUrl.trim().length === 0) {
    expect.fail("SUBMISSION_SERVICE_TEST_DATABASE_URL is required for integration tests");
  }

  return testDatabaseUrl;
};

describe.skipIf(!shouldRunIntegrationTests)("PostgresSubmissionRepository integration", () => {
  let pool: Pool;

  beforeEach(async () => {
    pool = new Pool({ connectionString: requireTestDatabaseUrl() });
    await ensureSubmissionSchema({ pool });
    await pool.query("TRUNCATE TABLE submissions");
  });

  afterEach(async () => {
    await pool.end();
  });

  it("saves and finds a submitted submission by id", async () => {
    const repository = createPostgresSubmissionRepository({ pool });
    const submission = createSubmittedSubmission({
      id: "33333333-3333-4333-8333-333333333333",
      challengeId,
      createdAt: new Date("2026-06-16T09:00:00.000Z"),
    });

    await repository.save({ submission });

    const foundSubmission = await repository.findById({ submissionId: submission.id });

    expect(foundSubmission).toMatchObject({
      id: submission.id,
      challengeId,
      startupOrganizationId: "org-startup",
      summary: "Bio-based packaging solution.",
      status: "submitted",
      decidedAt: null,
    });
    expect(foundSubmission?.createdAt.toISOString()).toBe("2026-06-16T09:00:00.000Z");
  });

  it("updates an existing submission decision on save", async () => {
    const repository = createPostgresSubmissionRepository({ pool });
    const submission = createSubmittedSubmission({
      id: "44444444-4444-4444-8444-444444444444",
      challengeId,
      createdAt: new Date("2026-06-16T09:00:00.000Z"),
    });
    const acceptedSubmission: Submission = {
      ...submission,
      status: "accepted",
      decidedAt: new Date("2026-06-16T10:00:00.000Z"),
    };

    await repository.save({ submission });
    await repository.save({ submission: acceptedSubmission });

    const foundSubmission = await repository.findById({ submissionId: submission.id });

    expect(foundSubmission?.status).toBe("accepted");
    expect(foundSubmission?.decidedAt?.toISOString()).toBe("2026-06-16T10:00:00.000Z");
  });

  it("lists submissions for one challenge from newest to oldest", async () => {
    const repository = createPostgresSubmissionRepository({ pool });
    const olderSubmission = createSubmittedSubmission({
      id: "55555555-5555-4555-8555-555555555555",
      challengeId,
      createdAt: new Date("2026-06-16T09:00:00.000Z"),
      summary: "Older proposal.",
    });
    const newerSubmission = createSubmittedSubmission({
      id: "66666666-6666-4666-8666-666666666666",
      challengeId,
      createdAt: new Date("2026-06-16T10:00:00.000Z"),
      summary: "Newer proposal.",
    });
    const unrelatedSubmission = createSubmittedSubmission({
      id: "77777777-7777-4777-8777-777777777777",
      challengeId: otherChallengeId,
      createdAt: new Date("2026-06-16T11:00:00.000Z"),
      summary: "Unrelated proposal.",
    });

    await repository.save({ submission: olderSubmission });
    await repository.save({ submission: newerSubmission });
    await repository.save({ submission: unrelatedSubmission });

    const submissions = await repository.findByChallengeId({ challengeId });

    expect(submissions.map((submission) => submission.id)).toEqual([
      newerSubmission.id,
      olderSubmission.id,
    ]);
  });
});

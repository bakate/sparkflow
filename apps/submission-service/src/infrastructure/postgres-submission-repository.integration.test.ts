import { faker } from "@faker-js/faker";
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

const createSubmittedSubmission = (input: {
  readonly id: string;
  readonly challengeId: string;
  readonly createdAt: Date;
  readonly startupOrganizationId?: string;
  readonly summary?: string;
}): Submission => ({
  id: input.id,
  challengeId: input.challengeId,
  startupOrganizationId: input.startupOrganizationId ?? faker.string.uuid(),
  summary: input.summary ?? faker.company.catchPhrase(),
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
    const challengeId = faker.string.uuid();
    const submission = createSubmittedSubmission({
      id: faker.string.uuid(),
      challengeId,
      createdAt: new Date("2026-06-16T09:00:00.000Z"),
    });

    await repository.save({ submission });

    const foundSubmission = await repository.findById({ submissionId: submission.id });

    expect(foundSubmission).toMatchObject({
      id: submission.id,
      challengeId,
      startupOrganizationId: submission.startupOrganizationId,
      summary: submission.summary,
      status: "submitted",
      decidedAt: null,
    });
    expect(foundSubmission?.createdAt.toISOString()).toBe("2026-06-16T09:00:00.000Z");
  });

  it("updates an existing submission decision on save", async () => {
    const repository = createPostgresSubmissionRepository({ pool });
    const challengeId = faker.string.uuid();
    const submission = createSubmittedSubmission({
      id: faker.string.uuid(),
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
    const challengeId = faker.string.uuid();
    const otherChallengeId = faker.string.uuid();
    const olderSubmission = createSubmittedSubmission({
      id: faker.string.uuid(),
      challengeId,
      createdAt: new Date("2026-06-16T09:00:00.000Z"),
      summary: faker.company.catchPhrase(),
    });
    const newerSubmission = createSubmittedSubmission({
      id: faker.string.uuid(),
      challengeId,
      createdAt: new Date("2026-06-16T10:00:00.000Z"),
      summary: faker.company.catchPhrase(),
    });
    const unrelatedSubmission = createSubmittedSubmission({
      id: faker.string.uuid(),
      challengeId: otherChallengeId,
      createdAt: new Date("2026-06-16T11:00:00.000Z"),
      summary: faker.company.catchPhrase(),
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

  it("lists submissions for one startup organization from newest to oldest", async () => {
    const repository = createPostgresSubmissionRepository({ pool });
    const startupOrganizationId = faker.string.uuid();
    const olderSubmission = createSubmittedSubmission({
      id: faker.string.uuid(),
      challengeId: faker.string.uuid(),
      startupOrganizationId,
      createdAt: new Date("2026-06-16T09:00:00.000Z"),
    });
    const newerSubmission = createSubmittedSubmission({
      id: faker.string.uuid(),
      challengeId: faker.string.uuid(),
      startupOrganizationId,
      createdAt: new Date("2026-06-16T10:00:00.000Z"),
    });
    const unrelatedSubmission = createSubmittedSubmission({
      id: faker.string.uuid(),
      challengeId: faker.string.uuid(),
      startupOrganizationId: faker.string.uuid(),
      createdAt: new Date("2026-06-16T11:00:00.000Z"),
    });

    await repository.save({ submission: olderSubmission });
    await repository.save({ submission: newerSubmission });
    await repository.save({ submission: unrelatedSubmission });

    const submissions = await repository.findByStartupOrganizationId({ startupOrganizationId });

    expect(submissions.map((submission) => submission.id)).toEqual([
      newerSubmission.id,
      olderSubmission.id,
    ]);
  });
});

import { Pool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Challenge } from "../domain/challenge.ts";
import {
  createPostgresChallengeRepository,
  ensureChallengeSchema,
} from "./postgres-challenge-repository.ts";

const testDatabaseUrl = process.env.CHALLENGE_SERVICE_TEST_DATABASE_URL;
const shouldRunIntegrationTests =
  testDatabaseUrl !== undefined && testDatabaseUrl.trim().length > 0;

const createDraftChallenge = (input: {
  readonly id: string;
  readonly createdAt: Date;
  readonly title?: string;
}): Challenge => ({
  id: input.id,
  title: input.title ?? "Circular packaging scouting",
  description: "Find startups for packaging waste reduction.",
  ownerOrganizationId: "org-company",
  status: "draft",
  createdAt: input.createdAt,
  publishedAt: null,
});

const requireTestDatabaseUrl = (): string => {
  if (testDatabaseUrl === undefined || testDatabaseUrl.trim().length === 0) {
    expect.fail("CHALLENGE_SERVICE_TEST_DATABASE_URL is required for integration tests");
  }

  return testDatabaseUrl;
};

describe.skipIf(!shouldRunIntegrationTests)("PostgresChallengeRepository integration", () => {
  let pool: Pool;

  beforeEach(async () => {
    pool = new Pool({ connectionString: requireTestDatabaseUrl() });
    await ensureChallengeSchema({ pool });
    await pool.query("TRUNCATE TABLE challenges");
  });

  afterEach(async () => {
    await pool.end();
  });

  it("saves and finds a draft challenge by id", async () => {
    const repository = createPostgresChallengeRepository({ pool });
    const challenge = createDraftChallenge({
      id: "11111111-1111-4111-8111-111111111111",
      createdAt: new Date("2026-06-16T09:00:00.000Z"),
    });

    await repository.save({ challenge });

    const foundChallenge = await repository.findById({ challengeId: challenge.id });

    expect(foundChallenge).toMatchObject({
      id: challenge.id,
      title: "Circular packaging scouting",
      description: "Find startups for packaging waste reduction.",
      ownerOrganizationId: "org-company",
      status: "draft",
      publishedAt: null,
    });
    expect(foundChallenge?.createdAt.toISOString()).toBe("2026-06-16T09:00:00.000Z");
  });

  it("updates an existing challenge on save", async () => {
    const repository = createPostgresChallengeRepository({ pool });
    const challenge = createDraftChallenge({
      id: "22222222-2222-4222-8222-222222222222",
      createdAt: new Date("2026-06-16T09:00:00.000Z"),
    });
    const publishedChallenge: Challenge = {
      ...challenge,
      status: "published",
      publishedAt: new Date("2026-06-16T10:00:00.000Z"),
    };

    await repository.save({ challenge });
    await repository.save({ challenge: publishedChallenge });

    const foundChallenge = await repository.findById({ challengeId: challenge.id });

    expect(foundChallenge?.status).toBe("published");
    expect(foundChallenge?.publishedAt?.toISOString()).toBe("2026-06-16T10:00:00.000Z");
  });

  it("lists challenges from newest to oldest", async () => {
    const repository = createPostgresChallengeRepository({ pool });
    const olderChallenge = createDraftChallenge({
      id: "33333333-3333-4333-8333-333333333333",
      title: "Older challenge",
      createdAt: new Date("2026-06-16T09:00:00.000Z"),
    });
    const newerChallenge = createDraftChallenge({
      id: "44444444-4444-4444-8444-444444444444",
      title: "Newer challenge",
      createdAt: new Date("2026-06-16T10:00:00.000Z"),
    });

    await repository.save({ challenge: olderChallenge });
    await repository.save({ challenge: newerChallenge });

    const challenges = await repository.findAll();

    expect(challenges.map((challenge) => challenge.id)).toEqual([
      newerChallenge.id,
      olderChallenge.id,
    ]);
  });
});

import { faker } from "@faker-js/faker";
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
  title: input.title ?? faker.company.catchPhrase(),
  description: faker.lorem.sentence(),
  ownerOrganizationId: faker.string.uuid(),
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
      id: faker.string.uuid(),
      createdAt: new Date("2026-06-16T09:00:00.000Z"),
    });

    await repository.save({ challenge });

    const foundChallenge = await repository.findById({ challengeId: challenge.id });

    expect(foundChallenge).toMatchObject({
      id: challenge.id,
      title: challenge.title,
      description: challenge.description,
      ownerOrganizationId: challenge.ownerOrganizationId,
      status: "draft",
      publishedAt: null,
    });
    expect(foundChallenge?.createdAt.toISOString()).toBe("2026-06-16T09:00:00.000Z");
  });

  it("updates an existing challenge on save", async () => {
    const repository = createPostgresChallengeRepository({ pool });
    const challenge = createDraftChallenge({
      id: faker.string.uuid(),
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
      id: faker.string.uuid(),
      title: faker.company.catchPhrase(),
      createdAt: new Date("2026-06-16T09:00:00.000Z"),
    });
    const newerChallenge = createDraftChallenge({
      id: faker.string.uuid(),
      title: faker.company.catchPhrase(),
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

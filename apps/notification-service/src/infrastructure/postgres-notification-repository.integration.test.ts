import { faker } from "@faker-js/faker";
import { Pool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Notification } from "../domain/notification.ts";
import {
  createPostgresNotificationRepository,
  ensureNotificationSchema,
} from "./postgres-notification-repository.ts";

const testDatabaseUrl = process.env.NOTIFICATION_SERVICE_TEST_DATABASE_URL;
const shouldRunIntegrationTests =
  testDatabaseUrl !== undefined && testDatabaseUrl.trim().length > 0;

const createNotificationFixture = (input: {
  readonly id: string;
  readonly eventId: string;
  readonly recipientOrganizationId: string;
  readonly createdAt: Date;
  readonly actionUrl?: string | null;
  readonly title?: string;
}): Notification => ({
  id: input.id,
  eventId: input.eventId ?? faker.string.uuid(),
  recipientOrganizationId: input.recipientOrganizationId,
  title: input.title ?? faker.company.catchPhrase(),
  message: faker.lorem.sentence(),
  actionUrl: input.actionUrl ?? null,
  readAt: null,
  createdAt: input.createdAt,
});

const requireTestDatabaseUrl = (): string => {
  if (testDatabaseUrl === undefined || testDatabaseUrl.trim().length === 0) {
    expect.fail("NOTIFICATION_SERVICE_TEST_DATABASE_URL is required for integration tests");
  }

  return testDatabaseUrl;
};

describe.skipIf(!shouldRunIntegrationTests)("PostgresNotificationRepository integration", () => {
  let pool: Pool;

  beforeEach(async () => {
    pool = new Pool({ connectionString: requireTestDatabaseUrl() });
    await ensureNotificationSchema({ pool });
    await pool.query("TRUNCATE TABLE notifications");
  });

  afterEach(async () => {
    await pool.end();
  });

  it("saves a notification and checks existence by event id", async () => {
    const repository = createPostgresNotificationRepository({ pool });
    const notification = createNotificationFixture({
      id: faker.string.uuid(),
      eventId: faker.string.uuid(),
      recipientOrganizationId: faker.string.uuid(),
      createdAt: new Date("2026-06-16T09:00:00.000Z"),
    });

    await repository.save({ notification });

    const exists = await repository.existsByEventId({ eventId: notification.eventId });
    const missingExists = await repository.existsByEventId({ eventId: faker.string.uuid() });

    expect(exists).toBe(true);
    expect(missingExists).toBe(false);
  });

  it("does not insert duplicates for the same event id", async () => {
    const repository = createPostgresNotificationRepository({ pool });
    const eventId = faker.string.uuid();
    const recipientOrganizationId = faker.string.uuid();
    const originalNotification = createNotificationFixture({
      id: faker.string.uuid(),
      eventId,
      recipientOrganizationId,
      createdAt: new Date("2026-06-16T09:00:00.000Z"),
      title: "Original notification",
      actionUrl: "/opportunities?submissionId=submission-1",
    });
    const duplicateNotification = createNotificationFixture({
      id: faker.string.uuid(),
      eventId,
      recipientOrganizationId,
      createdAt: new Date("2026-06-16T10:00:00.000Z"),
      title: "Duplicate notification",
      actionUrl: "/opportunities?submissionId=submission-2",
    });

    await repository.save({ notification: originalNotification });
    await repository.save({ notification: duplicateNotification });

    const notifications = await repository.findByOrganizationId({
      organizationId: recipientOrganizationId,
    });

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      id: originalNotification.id,
      eventId,
      title: "Original notification",
      actionUrl: "/opportunities?submissionId=submission-1",
    });
  });

  it("lists notifications for one organization from newest to oldest", async () => {
    const repository = createPostgresNotificationRepository({ pool });
    const recipientOrganizationId = faker.string.uuid();
    const otherRecipientOrganizationId = faker.string.uuid();
    const olderNotification = createNotificationFixture({
      id: faker.string.uuid(),
      eventId: faker.string.uuid(),
      recipientOrganizationId,
      createdAt: new Date("2026-06-16T09:00:00.000Z"),
    });
    const newerNotification = createNotificationFixture({
      id: faker.string.uuid(),
      eventId: faker.string.uuid(),
      recipientOrganizationId,
      createdAt: new Date("2026-06-16T10:00:00.000Z"),
    });
    const unrelatedNotification = createNotificationFixture({
      id: faker.string.uuid(),
      eventId: faker.string.uuid(),
      recipientOrganizationId: otherRecipientOrganizationId,
      createdAt: new Date("2026-06-16T11:00:00.000Z"),
    });

    await Promise.all([
      repository.save({ notification: olderNotification }),
      repository.save({ notification: newerNotification }),
      repository.save({ notification: unrelatedNotification }),
    ]);

    const notifications = await repository.findByOrganizationId({
      organizationId: recipientOrganizationId,
    });

    expect(notifications.map((notification) => notification.id)).toEqual([
      newerNotification.id,
      olderNotification.id,
    ]);
  });
});

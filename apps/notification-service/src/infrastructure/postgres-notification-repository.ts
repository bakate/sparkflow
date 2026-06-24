import { Pool } from "pg";
import type { NotificationRepository } from "../application/ports.ts";
import type { Notification } from "../domain/notification.ts";

type NotificationRow = {
  readonly id: string;
  readonly event_id: string;
  readonly recipient_organization_id: string;
  readonly title: string;
  readonly message: string;
  readonly action_url: string | null;
  readonly created_at: Date;
};

const toNotification = (row: NotificationRow): Notification => ({
  id: row.id,
  eventId: row.event_id,
  recipientOrganizationId: row.recipient_organization_id,
  title: row.title,
  message: row.message,
  actionUrl: row.action_url,
  createdAt: row.created_at,
});

export const createPostgresNotificationRepository = (input: {
  readonly pool: Pool;
}): NotificationRepository => ({
  save: async ({ notification }) => {
    await input.pool.query(
      `INSERT INTO notifications (
        id, event_id, recipient_organization_id, title, message, action_url, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (event_id) DO NOTHING`,
      [
        notification.id,
        notification.eventId,
        notification.recipientOrganizationId,
        notification.title,
        notification.message,
        notification.actionUrl,
        notification.createdAt,
      ],
    );
  },
  existsByEventId: async ({ eventId }) => {
    const result = await input.pool.query<{ readonly exists: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM notifications WHERE event_id = $1) AS exists",
      [eventId],
    );

    return result.rows[0]?.exists ?? false;
  },
  findByOrganizationId: async ({ organizationId }) => {
    const result = await input.pool.query<NotificationRow>(
      `SELECT * FROM notifications
       WHERE recipient_organization_id = $1
       ORDER BY created_at DESC`,
      [organizationId],
    );

    return result.rows.map(toNotification);
  },
});

export const ensureNotificationSchema = async (input: { readonly pool: Pool }): Promise<void> => {
  await input.pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id uuid PRIMARY KEY,
      event_id uuid NOT NULL UNIQUE,
      recipient_organization_id text NOT NULL,
      title text NOT NULL,
      message text NOT NULL,
      action_url text,
      created_at timestamptz NOT NULL
    )
  `);
  await input.pool.query("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url text");
};

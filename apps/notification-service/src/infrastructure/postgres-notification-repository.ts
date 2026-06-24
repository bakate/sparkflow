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
  readonly read_at: Date | null;
  readonly created_at: Date;
};

const toNotification = (row: NotificationRow): Notification => ({
  id: row.id,
  eventId: row.event_id,
  recipientOrganizationId: row.recipient_organization_id,
  title: row.title,
  message: row.message,
  actionUrl: row.action_url,
  readAt: row.read_at,
  createdAt: row.created_at,
});

const toCursorPage = <TEntity extends { readonly id: string }>(input: {
  readonly rows: readonly TEntity[];
  readonly limit: number;
}): { readonly items: readonly TEntity[]; readonly nextCursor: string | null } => {
  const items = input.rows.slice(0, input.limit);
  const hasNextPage = input.rows.length > input.limit;
  const lastItem = items.at(-1);

  return {
    items,
    nextCursor: hasNextPage && lastItem !== undefined ? lastItem.id : null,
  };
};

export const createPostgresNotificationRepository = (input: {
  readonly pool: Pool;
}): NotificationRepository => ({
  save: async ({ notification }) => {
    await input.pool.query(
      `INSERT INTO notifications (
        id, event_id, recipient_organization_id, title, message, action_url, read_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (event_id) DO NOTHING`,
      [
        notification.id,
        notification.eventId,
        notification.recipientOrganizationId,
        notification.title,
        notification.message,
        notification.actionUrl,
        notification.readAt,
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
  findByOrganizationId: async ({ organizationId, page }) => {
    const result = await input.pool.query<NotificationRow>(
      `SELECT * FROM notifications
       WHERE recipient_organization_id = $1
       AND (
         $2::uuid IS NULL
         OR (created_at, id) < (
           SELECT cursor_notification.created_at, cursor_notification.id
           FROM notifications AS cursor_notification
           WHERE cursor_notification.id = $2::uuid
           AND cursor_notification.recipient_organization_id = $1
         )
       )
       ORDER BY created_at DESC, id DESC
       LIMIT $3`,
      [organizationId, page.cursor, page.limit + 1],
    );

    return toCursorPage({ rows: result.rows.map(toNotification), limit: page.limit });
  },
  markRead: async ({ notificationId, organizationId, readAt }) => {
    const result = await input.pool.query<NotificationRow>(
      `UPDATE notifications
       SET read_at = COALESCE(read_at, $3)
       WHERE id = $1 AND recipient_organization_id = $2
       RETURNING *`,
      [notificationId, organizationId, readAt],
    );

    return result.rows[0] === undefined ? null : toNotification(result.rows[0]);
  },
  markAllReadByOrganizationId: async ({ organizationId, readAt }) => {
    const result = await input.pool.query<NotificationRow>(
      `UPDATE notifications
       SET read_at = $2
       WHERE recipient_organization_id = $1 AND read_at IS NULL
       RETURNING *`,
      [organizationId, readAt],
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
      read_at timestamptz,
      created_at timestamptz NOT NULL
    )
  `);
  await input.pool.query("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url text");
  await input.pool.query("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at timestamptz");
  await input.pool.query(`
    CREATE INDEX IF NOT EXISTS notifications_recipient_created_at_idx
    ON notifications (recipient_organization_id, created_at DESC, id DESC)
  `);
};

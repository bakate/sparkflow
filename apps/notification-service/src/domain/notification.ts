import type { NotificationDto } from "@sparkflow/contracts";

export type Notification = {
  readonly id: string;
  readonly eventId: string;
  readonly recipientOrganizationId: string;
  readonly title: string;
  readonly message: string;
  readonly actionUrl: string | null;
  readonly createdAt: Date;
};

export const createNotification = (input: {
  readonly id: string;
  readonly eventId: string;
  readonly recipientOrganizationId: string;
  readonly title: string;
  readonly message: string;
  readonly actionUrl: string | null;
  readonly now: Date;
}): Notification => ({
  id: input.id,
  eventId: input.eventId,
  recipientOrganizationId: input.recipientOrganizationId,
  title: input.title,
  message: input.message,
  actionUrl: input.actionUrl,
  createdAt: input.now,
});

export const toNotificationDto = (notification: Notification): NotificationDto => ({
  id: notification.id,
  eventId: notification.eventId,
  recipientOrganizationId: notification.recipientOrganizationId,
  title: notification.title,
  message: notification.message,
  actionUrl: notification.actionUrl,
  createdAt: notification.createdAt.toISOString(),
});

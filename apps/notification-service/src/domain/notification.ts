import type { NotificationDto } from "@sparkflow/contracts";

export type Notification = {
  readonly id: string;
  readonly eventId: string;
  readonly recipientOrganizationId: string;
  readonly title: string;
  readonly message: string;
  readonly createdAt: Date;
};

export const createNotification = (input: {
  readonly id: string;
  readonly eventId: string;
  readonly recipientOrganizationId: string;
  readonly title: string;
  readonly message: string;
  readonly now: Date;
}): Notification => ({
  id: input.id,
  eventId: input.eventId,
  recipientOrganizationId: input.recipientOrganizationId,
  title: input.title,
  message: input.message,
  createdAt: input.now,
});

export const toNotificationDto = (notification: Notification): NotificationDto => ({
  id: notification.id,
  eventId: notification.eventId,
  recipientOrganizationId: notification.recipientOrganizationId,
  title: notification.title,
  message: notification.message,
  createdAt: notification.createdAt.toISOString(),
});

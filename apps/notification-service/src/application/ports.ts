import type { Notification } from "../domain/notification.ts";

export type NotificationRepository = {
  readonly save: (input: { readonly notification: Notification }) => Promise<void>;
  readonly existsByEventId: (input: { readonly eventId: string }) => Promise<boolean>;
  readonly findByOrganizationId: (input: {
    readonly organizationId: string;
  }) => Promise<readonly Notification[]>;
  readonly markRead: (input: {
    readonly notificationId: string;
    readonly organizationId: string;
    readonly readAt: Date;
  }) => Promise<Notification | null>;
  readonly markAllReadByOrganizationId: (input: {
    readonly organizationId: string;
    readonly readAt: Date;
  }) => Promise<readonly Notification[]>;
};

export type Clock = {
  readonly now: () => Date;
};

export type IdGenerator = {
  readonly generate: () => string;
};

import type { Notification } from "../domain/notification.ts";

export type NotificationRepository = {
  readonly save: (input: { readonly notification: Notification }) => Promise<void>;
  readonly existsByEventId: (input: { readonly eventId: string }) => Promise<boolean>;
  readonly findByOrganizationId: (input: {
    readonly organizationId: string;
  }) => Promise<readonly Notification[]>;
};

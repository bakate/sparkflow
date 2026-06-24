import type { CursorPageRequestDto } from "@sparkflow/contracts";
import type { Notification } from "../domain/notification.ts";

export type CursorPage<TEntity> = {
  readonly items: readonly TEntity[];
  readonly nextCursor: string | null;
};

export type NotificationRepository = {
  readonly save: (input: { readonly notification: Notification }) => Promise<void>;
  readonly existsByEventId: (input: { readonly eventId: string }) => Promise<boolean>;
  readonly findByOrganizationId: (input: {
    readonly organizationId: string;
    readonly page: CursorPageRequestDto;
  }) => Promise<CursorPage<Notification>>;
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

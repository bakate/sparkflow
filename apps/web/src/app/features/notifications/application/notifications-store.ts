import { computed, inject, resource, Service } from '@angular/core';
import { AuthSession } from '@shared/auth/auth-session';
import { fail, type Result, succeed } from '@shared/domain/result';
import type { Notification } from '../domain/notification';
import { NOTIFICATION_GATEWAY, type NotificationFailure } from './notification-gateway';

@Service()
export class NotificationsStore {
  private readonly authSession = inject(AuthSession);
  private readonly notificationGateway = inject(NOTIFICATION_GATEWAY);
  private readonly notificationsResource = resource({
    defaultValue: succeed<readonly Notification[]>([]),
    loader: () => {
      const actor = this.authSession.currentActor();

      return actor === null
        ? Promise.resolve(succeed<readonly Notification[]>([]))
        : this.notificationGateway.listNotifications();
    },
  });

  readonly notifications = computed(() => {
    const result = this.notificationsResource.value();

    return result.ok ? result.value : [];
  });
  readonly latestNotifications = computed(() => this.notifications().slice(0, 5));
  readonly unreadNotifications = computed(() =>
    this.notifications().filter((notification) => notification.readAt === null),
  );
  readonly unreadNotificationCount = computed(() => this.unreadNotifications().length);
  readonly notificationCount = this.unreadNotificationCount;
  readonly loading = this.notificationsResource.isLoading;
  readonly error = computed(() => {
    const result = this.notificationsResource.value();

    return result.ok ? null : result.error;
  });

  reloadNotifications(): boolean {
    return this.notificationsResource.reload();
  }

  async markNotificationRead(input: {
    readonly notificationId: string;
  }): Promise<Result<NotificationFailure, Notification>> {
    const result = await this.notificationGateway.markNotificationRead(input);

    if (!result.ok) {
      return fail(result.error);
    }

    this.replaceNotification({ notification: result.value });

    return succeed(result.value);
  }

  async markAllNotificationsRead(): Promise<Result<NotificationFailure, readonly Notification[]>> {
    const result = await this.notificationGateway.markAllNotificationsRead();

    if (!result.ok) {
      return fail(result.error);
    }

    this.replaceNotifications({ notifications: result.value });

    return succeed(result.value);
  }

  private replaceNotification(input: { readonly notification: Notification }): void {
    this.notificationsResource.update((currentResult) =>
      currentResult.ok
        ? succeed(
            currentResult.value.map((notification) =>
              notification.id === input.notification.id ? input.notification : notification,
            ),
          )
        : succeed([input.notification]),
    );
  }

  private replaceNotifications(input: { readonly notifications: readonly Notification[] }): void {
    this.notificationsResource.update((currentResult) => {
      if (!currentResult.ok) {
        return succeed(input.notifications);
      }

      const updatedNotificationsById = new Map(
        input.notifications.map((notification) => [notification.id, notification] as const),
      );

      return succeed(
        currentResult.value.map(
          (notification) => updatedNotificationsById.get(notification.id) ?? notification,
        ),
      );
    });
  }
}

import { computed, inject, resource, Service } from '@angular/core';
import { AuthSession } from '@shared/auth/auth-session';
import { succeed } from '@shared/domain/result';
import type { Notification } from '../domain/notification';
import { NOTIFICATION_GATEWAY } from './notification-gateway';

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
  readonly notificationCount = computed(() => this.notifications().length);
  readonly loading = this.notificationsResource.isLoading;
  readonly error = computed(() => {
    const result = this.notificationsResource.value();

    return result.ok ? null : result.error;
  });

  reloadNotifications(): boolean {
    return this.notificationsResource.reload();
  }
}

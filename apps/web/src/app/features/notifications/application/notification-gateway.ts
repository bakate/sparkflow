import { InjectionToken } from '@angular/core';
import type { Result } from '@shared/domain/result';
import type { Notification } from '../domain/notification';

export type NotificationFailure = 'network-error' | 'unexpected-error';

export type NotificationGateway = {
  readonly listNotifications: () => Promise<Result<NotificationFailure, readonly Notification[]>>;
};

export const NOTIFICATION_GATEWAY = new InjectionToken<NotificationGateway>('NOTIFICATION_GATEWAY');

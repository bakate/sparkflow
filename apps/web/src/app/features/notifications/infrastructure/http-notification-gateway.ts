import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { NotificationDto, PaginatedDto } from '@sparkflow/contracts';
import { firstValueFrom, timeout } from 'rxjs';
import { fail, type Result, succeed } from '@shared/domain/result';
import { WEB_API_CONFIG } from '@shared/infrastructure/web-api.config';
import type { NotificationFailure, NotificationGateway } from '../application/notification-gateway';
import type { Notification } from '../domain/notification';

@Injectable()
export class HttpNotificationGateway implements NotificationGateway {
  private readonly httpClient = inject(HttpClient);
  private readonly webApiConfig = inject(WEB_API_CONFIG);

  async listNotifications(): Promise<Result<NotificationFailure, readonly Notification[]>> {
    try {
      const notificationDtos = await firstValueFrom(
        this.httpClient
          .get<PaginatedDto<NotificationDto>>(this.buildUrl({ path: '/notifications' }))
          .pipe(timeout(5000)),
      );

      return succeed(
        notificationDtos.items.map((notificationDto) => toNotification({ notificationDto })),
      );
    } catch (error: unknown) {
      return fail(toNotificationFailure({ error }));
    }
  }

  async markNotificationRead(input: {
    readonly notificationId: string;
  }): Promise<Result<NotificationFailure, Notification>> {
    try {
      const notificationDto = await firstValueFrom(
        this.httpClient
          .post<NotificationDto>(
            this.buildUrl({ path: `/notifications/${input.notificationId}/read` }),
            {},
          )
          .pipe(timeout(5000)),
      );

      return succeed(toNotification({ notificationDto }));
    } catch (error: unknown) {
      return fail(toNotificationFailure({ error }));
    }
  }

  async markAllNotificationsRead(): Promise<Result<NotificationFailure, readonly Notification[]>> {
    try {
      const notificationDtos = await firstValueFrom(
        this.httpClient
          .post<NotificationDto[]>(this.buildUrl({ path: '/notifications/read-all' }), {})
          .pipe(timeout(5000)),
      );

      return succeed(
        notificationDtos.map((notificationDto) => toNotification({ notificationDto })),
      );
    } catch (error: unknown) {
      return fail(toNotificationFailure({ error }));
    }
  }

  private buildUrl(input: { readonly path: string }): string {
    return `${this.webApiConfig.apiUrl}${input.path}`;
  }
}

const toNotification = (input: { readonly notificationDto: NotificationDto }): Notification => ({
  id: input.notificationDto.id,
  eventId: input.notificationDto.eventId,
  recipientOrganizationId: input.notificationDto.recipientOrganizationId,
  title: input.notificationDto.title,
  message: input.notificationDto.message,
  actionUrl: input.notificationDto.actionUrl ?? null,
  readAt: input.notificationDto.readAt === null ? null : new Date(input.notificationDto.readAt),
  createdAt: new Date(input.notificationDto.createdAt),
});

const toNotificationFailure = (input: { readonly error: unknown }): NotificationFailure => {
  if (input.error instanceof HttpErrorResponse && input.error.status === 0) {
    return 'network-error';
  }

  return 'unexpected-error';
};

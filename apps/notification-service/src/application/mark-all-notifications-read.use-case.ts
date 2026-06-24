import type { NotificationDto } from "@sparkflow/contracts";
import { toNotificationDto } from "../domain/notification.ts";
import type { Clock, NotificationRepository } from "./ports.ts";

export type MarkAllNotificationsReadUseCase = {
  readonly execute: (input: {
    readonly organizationId: string;
  }) => Promise<readonly NotificationDto[]>;
};

export const createMarkAllNotificationsReadUseCase = (input: {
  readonly clock: Clock;
  readonly notificationRepository: NotificationRepository;
}): MarkAllNotificationsReadUseCase => ({
  execute: async ({ organizationId }) => {
    const notifications = await input.notificationRepository.markAllReadByOrganizationId({
      organizationId,
      readAt: input.clock.now(),
    });

    return notifications.map(toNotificationDto);
  },
});

import type { NotificationDto } from "@sparkflow/contracts";
import { toNotificationDto } from "../domain/notification.ts";
import type { Clock, NotificationRepository } from "./ports.ts";

export type MarkNotificationReadUseCase = {
  readonly execute: (input: {
    readonly notificationId: string;
    readonly organizationId: string;
  }) => Promise<NotificationDto | null>;
};

export const createMarkNotificationReadUseCase = (input: {
  readonly clock: Clock;
  readonly notificationRepository: NotificationRepository;
}): MarkNotificationReadUseCase => ({
  execute: async ({ notificationId, organizationId }) => {
    const notification = await input.notificationRepository.markRead({
      notificationId,
      organizationId,
      readAt: input.clock.now(),
    });

    return notification === null ? null : toNotificationDto(notification);
  },
});

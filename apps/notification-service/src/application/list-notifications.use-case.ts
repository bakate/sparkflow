import type { NotificationDto } from "@sparkflow/contracts";
import { toNotificationDto } from "../domain/notification.ts";
import type { NotificationRepository } from "./ports.ts";

export type ListNotificationsUseCase = {
  readonly execute: (input: {
    readonly organizationId: string;
  }) => Promise<readonly NotificationDto[]>;
};

export const createListNotificationsUseCase = (input: {
  readonly notificationRepository: NotificationRepository;
}): ListNotificationsUseCase => ({
  execute: async ({ organizationId }) => {
    const notifications = await input.notificationRepository.findByOrganizationId({
      organizationId,
    });

    return notifications.map(toNotificationDto);
  },
});

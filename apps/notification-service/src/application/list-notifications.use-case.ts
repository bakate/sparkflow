import type { CursorPageRequestDto, PaginatedDto, NotificationDto } from "@sparkflow/contracts";
import { toNotificationDto } from "../domain/notification.ts";
import type { NotificationRepository } from "./ports.ts";

export type ListNotificationsUseCase = {
  readonly execute: (input: {
    readonly organizationId: string;
    readonly page: CursorPageRequestDto;
  }) => Promise<PaginatedDto<NotificationDto>>;
};

export const createListNotificationsUseCase = (input: {
  readonly notificationRepository: NotificationRepository;
}): ListNotificationsUseCase => ({
  execute: async ({ organizationId, page }) => {
    const notificationsPage = await input.notificationRepository.findByOrganizationId({
      organizationId,
      page,
    });

    return {
      items: notificationsPage.items.map(toNotificationDto),
      page: { limit: page.limit, nextCursor: notificationsPage.nextCursor },
    };
  },
});

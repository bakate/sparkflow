import { logger } from "@sparkflow/logger";
import type { DomainEvent } from "@sparkflow/contracts";
import { connect, JSONCodec } from "nats";
import type { CreateNotificationFromEventUseCase } from "../application/create-notification-from-event.use-case.ts";

const jsonCodec = JSONCodec<DomainEvent>();

export const startNatsEventConsumer = async (input: {
  readonly natsUrl: string;
  readonly createNotificationFromEventUseCase: CreateNotificationFromEventUseCase;
}): Promise<void> => {
  const connection = await connect({ servers: input.natsUrl });
  const subscription = connection.subscribe(">");

  void (async () => {
    for await (const message of subscription) {
      const event = jsonCodec.decode(message.data);
      const notification = await input.createNotificationFromEventUseCase.execute({ event });

      if (notification !== null) {
        logger.info("notification created", { notificationId: notification.id });
      }
    }
  })();
};

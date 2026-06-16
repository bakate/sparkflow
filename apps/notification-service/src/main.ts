import { readEnvironmentVariable, readIntegerEnvironmentVariable } from "@sparkflow/config";
import { logger } from "@sparkflow/logger";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createCreateNotificationFromEventUseCase } from "./application/create-notification-from-event.use-case.ts";
import { createListNotificationsUseCase } from "./application/list-notifications.use-case.ts";
import { buildNotificationHttpServer } from "./infrastructure/http-server.ts";
import { startNatsEventConsumer } from "./infrastructure/nats-event-consumer.ts";
import {
  createPostgresNotificationRepository,
  ensureNotificationSchema,
} from "./infrastructure/postgres-notification-repository.ts";

const port = readIntegerEnvironmentVariable({ name: "PORT", fallback: 4003 });
const databaseUrl = readEnvironmentVariable({
  name: "DATABASE_URL",
  fallback: "postgres://sparkflow:sparkflow@localhost:5432/sparkflow_notification",
});
const natsUrl = readEnvironmentVariable({ name: "NATS_URL", fallback: "nats://localhost:4222" });

const pool = new Pool({ connectionString: databaseUrl });
await ensureNotificationSchema({ pool });

const notificationRepository = createPostgresNotificationRepository({ pool });
const clock = { now: () => new Date() } as const;
const idGenerator = { generate: () => randomUUID() } as const;
const createNotificationFromEventUseCase = createCreateNotificationFromEventUseCase({
  clock,
  idGenerator,
  notificationRepository,
});

await startNatsEventConsumer({ natsUrl, createNotificationFromEventUseCase });

const server = await buildNotificationHttpServer({
  listNotificationsUseCase: createListNotificationsUseCase({ notificationRepository }),
});

await server.listen({ host: "0.0.0.0", port });
logger.info("notification-service started", { port });

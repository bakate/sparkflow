import { readEnvironmentVariable, readIntegerEnvironmentVariable } from "@sparkflow/config";
import { logger } from "@sparkflow/logger";
import { Pool } from "pg";
import { createCreateSubmissionUseCase } from "./application/create-submission.use-case.ts";
import { createDecideSubmissionUseCase } from "./application/decide-submission.use-case.ts";
import { createListSubmissionsUseCase } from "./application/list-submissions.use-case.ts";
import { buildSubmissionHttpServer } from "./infrastructure/http-server.ts";
import { createNatsEventPublisher } from "./infrastructure/nats-event-publisher.ts";
import {
  createPostgresSubmissionRepository,
  ensureSubmissionSchema,
} from "./infrastructure/postgres-submission-repository.ts";

const port = readIntegerEnvironmentVariable({ name: "PORT", fallback: 4002 });
const databaseUrl = readEnvironmentVariable({
  name: "DATABASE_URL",
  fallback: "postgres://sparkflow:sparkflow@localhost:5432/sparkflow_submission",
});
const natsUrl = readEnvironmentVariable({ name: "NATS_URL", fallback: "nats://localhost:4222" });

const pool = new Pool({ connectionString: databaseUrl });
await ensureSubmissionSchema({ pool });

const submissionRepository = createPostgresSubmissionRepository({ pool });
const eventPublisher = await createNatsEventPublisher({ natsUrl });

const server = await buildSubmissionHttpServer({
  createSubmissionUseCase: createCreateSubmissionUseCase({ submissionRepository, eventPublisher }),
  decideSubmissionUseCase: createDecideSubmissionUseCase({ submissionRepository, eventPublisher }),
  listSubmissionsUseCase: createListSubmissionsUseCase({ submissionRepository }),
});

await server.listen({ host: "0.0.0.0", port });
logger.info("submission-service started", { port });

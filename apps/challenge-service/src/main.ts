import { readEnvironmentVariable, readIntegerEnvironmentVariable } from "@sparkflow/config";
import { logger } from "@sparkflow/logger";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createArchiveChallengeUseCase } from "./application/archive-challenge.use-case.ts";
import { createCreateChallengeUseCase } from "./application/create-challenge.use-case.ts";
import { createDraftChallengeUseCase } from "./application/draft-challenge.use-case.ts";
import { createGetChallengeUseCase } from "./application/get-challenge.use-case.ts";
import { createListChallengesUseCase } from "./application/list-challenges.use-case.ts";
import { createPublishChallengeUseCase } from "./application/publish-challenge.use-case.ts";
import { createUpdateChallengeUseCase } from "./application/update-challenge.use-case.ts";
import { buildChallengeHttpServer } from "./infrastructure/http-server.ts";
import { createNatsEventPublisher } from "./infrastructure/nats-event-publisher.ts";
import {
  createPostgresChallengeRepository,
  ensureChallengeSchema,
} from "./infrastructure/postgres-challenge-repository.ts";

const port = readIntegerEnvironmentVariable({ name: "PORT", fallback: 4001 });
const databaseUrl = readEnvironmentVariable({
  name: "DATABASE_URL",
  fallback: "postgres://sparkflow:sparkflow@localhost:5432/sparkflow_challenge",
});
const natsUrl = readEnvironmentVariable({ name: "NATS_URL", fallback: "nats://localhost:4222" });

const pool = new Pool({ connectionString: databaseUrl });
await ensureChallengeSchema({ pool });

const challengeRepository = createPostgresChallengeRepository({ pool });
const eventPublisher = await createNatsEventPublisher({ natsUrl });
const clock = { now: () => new Date() } as const;
const idGenerator = { generate: () => randomUUID() } as const;

const server = await buildChallengeHttpServer({
  archiveChallengeUseCase: createArchiveChallengeUseCase({ challengeRepository }),
  createChallengeUseCase: createCreateChallengeUseCase({
    challengeRepository,
    clock,
    idGenerator,
  }),
  draftChallengeUseCase: createDraftChallengeUseCase({ challengeRepository }),
  getChallengeUseCase: createGetChallengeUseCase({ challengeRepository }),
  updateChallengeUseCase: createUpdateChallengeUseCase({
    challengeRepository,
  }),
  publishChallengeUseCase: createPublishChallengeUseCase({
    challengeRepository,
    clock,
    eventPublisher,
    idGenerator,
  }),
  listChallengesUseCase: createListChallengesUseCase({ challengeRepository }),
});

await server.listen({ host: "0.0.0.0", port });
logger.info("challenge-service started", { port });

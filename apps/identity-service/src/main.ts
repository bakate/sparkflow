import { readIntegerEnvironmentVariable } from "@sparkflow/config";
import { logger } from "@sparkflow/logger";
import { createListUsersUseCase } from "./application/list-users.use-case.ts";
import { buildIdentityHttpServer } from "./infrastructure/http-server.ts";

const port = readIntegerEnvironmentVariable({ name: "PORT", fallback: 4000 });
const server = await buildIdentityHttpServer({
  listUsersUseCase: createListUsersUseCase(),
});

await server.listen({ host: "::", port });
logger.info("identity-service started", { port });

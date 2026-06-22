import { readEnvironmentVariable, readIntegerEnvironmentVariable } from "@sparkflow/config";
import { logger } from "@sparkflow/logger";
import { randomUUID } from "node:crypto";
import { createKeycloakAccessTokenVerifier } from "./auth/keycloak-access-token-verifier.ts";
import { buildApiGatewayServer } from "./build-api-gateway-server.ts";

const port = readIntegerEnvironmentVariable({ name: "PORT", fallback: 3000 });
const keycloakIssuer = readEnvironmentVariable({
  name: "KEYCLOAK_ISSUER",
  fallback: "http://localhost:8080/realms/sparkflow",
});
const keycloakClientId = readEnvironmentVariable({
  name: "KEYCLOAK_CLIENT_ID",
  fallback: "sparkflow-web",
});
const server = await buildApiGatewayServer({
  accessTokenVerifier: createKeycloakAccessTokenVerifier({
    issuer: keycloakIssuer,
    clientId: keycloakClientId,
  }),
  fetcher: fetch,
  idGenerator: { generate: () => randomUUID() },
  serviceUrls: {
    identityServiceUrl: readEnvironmentVariable({
      name: "IDENTITY_SERVICE_URL",
      fallback: "http://localhost:4000",
    }),
    challengeServiceUrl: readEnvironmentVariable({
      name: "CHALLENGE_SERVICE_URL",
      fallback: "http://localhost:4001",
    }),
    submissionServiceUrl: readEnvironmentVariable({
      name: "SUBMISSION_SERVICE_URL",
      fallback: "http://localhost:4002",
    }),
    notificationServiceUrl: readEnvironmentVariable({
      name: "NOTIFICATION_SERVICE_URL",
      fallback: "http://localhost:4003",
    }),
    evaluationServiceUrl: readEnvironmentVariable({
      name: "EVALUATION_SERVICE_URL",
      fallback: "http://localhost:4004",
    }),
  },
});

await server.listen({ host: "0.0.0.0", port });
logger.info("api-gateway started", { port });

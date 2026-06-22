import cors from "@fastify/cors";
import { readActor, readCorrelationId } from "@sparkflow/http";
import Fastify from "fastify";
import type { CreateChallengeUseCase } from "../application/create-challenge.use-case.ts";
import type { ListChallengesUseCase } from "../application/list-challenges.use-case.ts";
import type { PublishChallengeUseCase } from "../application/publish-challenge.use-case.ts";

type CreateChallengeBody = {
  readonly title?: string;
  readonly description?: string;
};

export const buildChallengeHttpServer = async (input: {
  readonly createChallengeUseCase: CreateChallengeUseCase;
  readonly publishChallengeUseCase: PublishChallengeUseCase;
  readonly listChallengesUseCase: ListChallengesUseCase;
}) => {
  const server = Fastify({ logger: false });
  await server.register(cors);

  server.get("/health", async () => ({ status: "ok" }));

  server.get("/challenges", async () => input.listChallengesUseCase.execute());

  server.post<{ Body: CreateChallengeBody }>("/challenges", async (request, reply) => {
    const result = await input.createChallengeUseCase.execute({
      actor: readActor({ headers: request.headers }),
      title: request.body.title ?? "",
      description: request.body.description ?? "",
    });

    if (!result.ok) {
      return reply.code(result.error === "forbidden" ? 403 : 400).send({ error: result.error });
    }

    return reply.code(201).send(result.value);
  });

  server.post<{ Params: { readonly challengeId: string } }>(
    "/challenges/:challengeId/publish",
    async (request, reply) => {
      const result = await input.publishChallengeUseCase.execute({
        actor: readActor({ headers: request.headers }),
        challengeId: request.params.challengeId,
        correlationId: readCorrelationId({ headers: request.headers }),
      });

      if (!result.ok) {
        const statusCode = result.error === "challenge-not-found" ? 404 : 400;
        return reply
          .code(result.error === "forbidden" ? 403 : statusCode)
          .send({ error: result.error });
      }

      return reply.send(result.value);
    },
  );

  return server;
};

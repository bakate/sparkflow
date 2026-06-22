import cors from "@fastify/cors";
import { readActor, readCorrelationId } from "@sparkflow/http";
import Fastify from "fastify";
import type { CreateSubmissionUseCase } from "../application/create-submission.use-case.ts";
import type { DecideSubmissionUseCase } from "../application/decide-submission.use-case.ts";
import type { ListSubmissionsUseCase } from "../application/list-submissions.use-case.ts";

type CreateSubmissionBody = {
  readonly summary?: string;
};

export const buildSubmissionHttpServer = async (input: {
  readonly createSubmissionUseCase: CreateSubmissionUseCase;
  readonly decideSubmissionUseCase: DecideSubmissionUseCase;
  readonly listSubmissionsUseCase: ListSubmissionsUseCase;
}) => {
  const server = Fastify({ logger: false });
  await server.register(cors);

  server.get("/health", async () => ({ status: "ok" }));

  server.get<{ Params: { readonly challengeId: string } }>(
    "/challenges/:challengeId/submissions",
    async (request) =>
      input.listSubmissionsUseCase.execute({ challengeId: request.params.challengeId }),
  );

  server.post<{ Params: { readonly challengeId: string }; Body: CreateSubmissionBody }>(
    "/challenges/:challengeId/submissions",
    async (request, reply) => {
      const result = await input.createSubmissionUseCase.execute({
        actor: readActor({ headers: request.headers }),
        challengeId: request.params.challengeId,
        summary: request.body.summary ?? "",
        correlationId: readCorrelationId({ headers: request.headers }),
      });

      if (!result.ok) {
        return reply.code(result.error === "forbidden" ? 403 : 400).send({ error: result.error });
      }

      return reply.code(201).send(result.value);
    },
  );

  server.post<{ Params: { readonly submissionId: string } }>(
    "/submissions/:submissionId/accept",
    async (request, reply) => {
      const result = await input.decideSubmissionUseCase.execute({
        actor: readActor({ headers: request.headers }),
        submissionId: request.params.submissionId,
        decision: "accept",
        correlationId: readCorrelationId({ headers: request.headers }),
      });

      if (!result.ok) {
        const statusCode = result.error === "submission-not-found" ? 404 : 400;
        return reply
          .code(result.error === "forbidden" ? 403 : statusCode)
          .send({ error: result.error });
      }

      return reply.send(result.value);
    },
  );

  server.post<{ Params: { readonly submissionId: string } }>(
    "/submissions/:submissionId/reject",
    async (request, reply) => {
      const result = await input.decideSubmissionUseCase.execute({
        actor: readActor({ headers: request.headers }),
        submissionId: request.params.submissionId,
        decision: "reject",
        correlationId: readCorrelationId({ headers: request.headers }),
      });

      if (!result.ok) {
        const statusCode = result.error === "submission-not-found" ? 404 : 400;
        return reply
          .code(result.error === "forbidden" ? 403 : statusCode)
          .send({ error: result.error });
      }

      return reply.send(result.value);
    },
  );

  return server;
};

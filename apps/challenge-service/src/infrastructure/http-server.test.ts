import type { ActorContext, ChallengeDto } from "@sparkflow/contracts";
import { fail, succeed } from "@sparkflow/result";
import { afterEach, describe, expect, it } from "vitest";
import type {
  CreateChallengeCommand,
  CreateChallengeUseCase,
} from "../application/create-challenge.use-case.js";
import type { ListChallengesUseCase } from "../application/list-challenges.use-case.js";
import type {
  PublishChallengeCommand,
  PublishChallengeUseCase,
} from "../application/publish-challenge.use-case.js";
import { buildChallengeHttpServer } from "./http-server.js";

const challengeDto: ChallengeDto = {
  id: "challenge-1",
  title: "Circular packaging scouting",
  description: "Find startups for packaging waste reduction.",
  ownerOrganizationId: "org-company",
  status: "draft",
  createdAt: "2026-06-16T10:00:00.000Z",
  publishedAt: null,
};

const publishedChallengeDto: ChallengeDto = {
  ...challengeDto,
  status: "published",
  publishedAt: "2026-06-16T11:00:00.000Z",
};

const openServers: { readonly close: () => Promise<void> }[] = [];

const readRecordedCommand = <TCommand>(input: {
  readonly commands: readonly TCommand[];
  readonly index?: number;
}): TCommand => {
  const command = input.commands[input.index ?? 0];

  if (command === undefined) {
    expect.fail("Missing recorded command");
  }

  return command;
};

const createRecordingCreateChallengeUseCase = (input?: {
  readonly result?: Awaited<ReturnType<CreateChallengeUseCase["execute"]>>;
}): CreateChallengeUseCase & { readonly commands: CreateChallengeCommand[] } => {
  const commands: CreateChallengeCommand[] = [];

  return {
    commands,
    execute: async (command) => {
      commands.push(command);
      return input?.result ?? succeed(challengeDto);
    },
  };
};

const createRecordingPublishChallengeUseCase = (input?: {
  readonly result?: Awaited<ReturnType<PublishChallengeUseCase["execute"]>>;
}): PublishChallengeUseCase & { readonly commands: PublishChallengeCommand[] } => {
  const commands: PublishChallengeCommand[] = [];

  return {
    commands,
    execute: async (command) => {
      commands.push(command);
      return input?.result ?? succeed(publishedChallengeDto);
    },
  };
};

const createListChallengesUseCase = (input: {
  readonly challenges: readonly ChallengeDto[];
}): ListChallengesUseCase => ({
  execute: async () => input.challenges,
});

const createServer = async (input?: {
  readonly createChallengeUseCase?: CreateChallengeUseCase;
  readonly publishChallengeUseCase?: PublishChallengeUseCase;
  readonly listChallengesUseCase?: ListChallengesUseCase;
}) => {
  const server = await buildChallengeHttpServer({
    createChallengeUseCase:
      input?.createChallengeUseCase ?? createRecordingCreateChallengeUseCase(),
    publishChallengeUseCase:
      input?.publishChallengeUseCase ?? createRecordingPublishChallengeUseCase(),
    listChallengesUseCase:
      input?.listChallengesUseCase ?? createListChallengesUseCase({ challenges: [] }),
  });

  openServers.push(server);

  return server;
};

afterEach(async () => {
  const serversToClose = [...openServers];
  openServers.length = 0;

  await Promise.all(serversToClose.map((server) => server.close()));
});

describe("buildChallengeHttpServer", () => {
  it("lists challenges through the list use case", async () => {
    const server = await createServer({
      listChallengesUseCase: createListChallengesUseCase({ challenges: [challengeDto] }),
    });

    const response = await server.inject({
      method: "GET",
      url: "/challenges",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([challengeDto]);
  });

  it("maps POST /challenges to the create challenge use case", async () => {
    const createChallengeUseCase = createRecordingCreateChallengeUseCase();
    const server = await createServer({ createChallengeUseCase });

    const response = await server.inject({
      method: "POST",
      url: "/challenges",
      headers: {
        "x-user-id": "company-user",
        "x-organization-id": "org-company",
        "x-role": "company-admin",
      },
      payload: {
        title: " Circular packaging scouting ",
        description: " Find startups for packaging waste reduction. ",
      },
    });

    const command = readRecordedCommand({ commands: createChallengeUseCase.commands });
    const actor: ActorContext = {
      userId: "company-user",
      organizationId: "org-company",
      role: "company-admin",
    };

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(challengeDto);
    expect(command).toEqual({
      actor,
      title: " Circular packaging scouting ",
      description: " Find startups for packaging waste reduction. ",
    });
  });

  it("maps create challenge failures to HTTP status codes", async () => {
    const server = await createServer({
      createChallengeUseCase: createRecordingCreateChallengeUseCase({
        result: fail("forbidden"),
      }),
    });

    const response = await server.inject({
      method: "POST",
      url: "/challenges",
      payload: {
        title: "Circular packaging scouting",
        description: "Find startups for packaging waste reduction.",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "forbidden" });
  });

  it("maps POST /challenges/:challengeId/publish to the publish use case", async () => {
    const publishChallengeUseCase = createRecordingPublishChallengeUseCase();
    const server = await createServer({ publishChallengeUseCase });

    const response = await server.inject({
      method: "POST",
      url: "/challenges/challenge-1/publish",
      headers: {
        "x-correlation-id": "correlation-1",
        "x-user-id": "company-user",
        "x-organization-id": "org-company",
        "x-role": "company-admin",
      },
    });

    const command = readRecordedCommand({ commands: publishChallengeUseCase.commands });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(publishedChallengeDto);
    expect(command).toEqual({
      actor: {
        userId: "company-user",
        organizationId: "org-company",
        role: "company-admin",
      },
      challengeId: "challenge-1",
      correlationId: "correlation-1",
    });
  });

  it("maps missing challenge publish failures to 404", async () => {
    const server = await createServer({
      publishChallengeUseCase: createRecordingPublishChallengeUseCase({
        result: fail("challenge-not-found"),
      }),
    });

    const response = await server.inject({
      method: "POST",
      url: "/challenges/missing-challenge/publish",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "challenge-not-found" });
  });
});

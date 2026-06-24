import type { ActorContext, ChallengeDto } from "@sparkflow/contracts";
import { fail, succeed } from "@sparkflow/result";
import { afterEach, describe, expect, it } from "vitest";
import type {
  ArchiveChallengeCommand,
  ArchiveChallengeUseCase,
} from "../application/archive-challenge.use-case.js";
import type {
  CreateChallengeCommand,
  CreateChallengeUseCase,
} from "../application/create-challenge.use-case.js";
import type {
  DraftChallengeCommand,
  DraftChallengeUseCase,
} from "../application/draft-challenge.use-case.js";
import type { GetChallengeUseCase } from "../application/get-challenge.use-case.js";
import type { ListChallengesUseCase } from "../application/list-challenges.use-case.js";
import type {
  PublishChallengeCommand,
  PublishChallengeUseCase,
} from "../application/publish-challenge.use-case.js";
import type {
  UpdateChallengeCommand,
  UpdateChallengeUseCase,
} from "../application/update-challenge.use-case.js";
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

const archivedChallengeDto: ChallengeDto = {
  ...publishedChallengeDto,
  status: "archived",
};

const draftedChallengeDto: ChallengeDto = {
  ...publishedChallengeDto,
  status: "draft",
  publishedAt: null,
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

const createRecordingArchiveChallengeUseCase = (input?: {
  readonly result?: Awaited<ReturnType<ArchiveChallengeUseCase["execute"]>>;
}): ArchiveChallengeUseCase & { readonly commands: ArchiveChallengeCommand[] } => {
  const commands: ArchiveChallengeCommand[] = [];

  return {
    commands,
    execute: async (command) => {
      commands.push(command);
      return input?.result ?? succeed(archivedChallengeDto);
    },
  };
};

const createRecordingDraftChallengeUseCase = (input?: {
  readonly result?: Awaited<ReturnType<DraftChallengeUseCase["execute"]>>;
}): DraftChallengeUseCase & { readonly commands: DraftChallengeCommand[] } => {
  const commands: DraftChallengeCommand[] = [];

  return {
    commands,
    execute: async (command) => {
      commands.push(command);
      return input?.result ?? succeed(draftedChallengeDto);
    },
  };
};

const createRecordingUpdateChallengeUseCase = (input?: {
  readonly result?: Awaited<ReturnType<UpdateChallengeUseCase["execute"]>>;
}): UpdateChallengeUseCase & { readonly commands: UpdateChallengeCommand[] } => {
  const commands: UpdateChallengeCommand[] = [];

  return {
    commands,
    execute: async (command) => {
      commands.push(command);
      return input?.result ?? succeed(challengeDto);
    },
  };
};

const createListChallengesUseCase = (input: {
  readonly challenges: readonly ChallengeDto[];
}): ListChallengesUseCase & { readonly actors: ActorContext[] } => {
  const actors: ActorContext[] = [];

  return {
    actors,
    execute: async ({ actor }) => {
      actors.push(actor);
      return input.challenges;
    },
  };
};

const createGetChallengeUseCase = (input: {
  readonly result: Awaited<ReturnType<GetChallengeUseCase["execute"]>>;
}): GetChallengeUseCase => ({
  execute: async () => input.result,
});

const createServer = async (input?: {
  readonly archiveChallengeUseCase?: ArchiveChallengeUseCase;
  readonly createChallengeUseCase?: CreateChallengeUseCase;
  readonly draftChallengeUseCase?: DraftChallengeUseCase;
  readonly getChallengeUseCase?: GetChallengeUseCase;
  readonly updateChallengeUseCase?: UpdateChallengeUseCase;
  readonly publishChallengeUseCase?: PublishChallengeUseCase;
  readonly listChallengesUseCase?: ListChallengesUseCase;
}) => {
  const server = await buildChallengeHttpServer({
    archiveChallengeUseCase:
      input?.archiveChallengeUseCase ?? createRecordingArchiveChallengeUseCase(),
    createChallengeUseCase:
      input?.createChallengeUseCase ?? createRecordingCreateChallengeUseCase(),
    draftChallengeUseCase: input?.draftChallengeUseCase ?? createRecordingDraftChallengeUseCase(),
    getChallengeUseCase:
      input?.getChallengeUseCase ?? createGetChallengeUseCase({ result: succeed(challengeDto) }),
    updateChallengeUseCase:
      input?.updateChallengeUseCase ?? createRecordingUpdateChallengeUseCase(),
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
    const listChallengesUseCase = createListChallengesUseCase({ challenges: [challengeDto] });
    const server = await createServer({
      listChallengesUseCase,
    });

    const response = await server.inject({
      method: "GET",
      url: "/challenges",
      headers: {
        "x-user-id": "company-user",
        "x-organization-id": "org-company",
        "x-role": "company-admin",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([challengeDto]);
    expect(listChallengesUseCase.actors).toEqual([
      {
        userId: "company-user",
        userEmail: null,
        organizationId: "org-company",
        role: "company-admin",
      },
    ]);
  });

  it("gets one challenge through the get use case", async () => {
    const server = await createServer({
      getChallengeUseCase: createGetChallengeUseCase({ result: succeed(challengeDto) }),
    });

    const response = await server.inject({
      method: "GET",
      url: "/challenges/challenge-1",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(challengeDto);
  });

  it("maps missing challenge reads to 404", async () => {
    const server = await createServer({
      getChallengeUseCase: createGetChallengeUseCase({ result: fail("challenge-not-found") }),
    });

    const response = await server.inject({
      method: "GET",
      url: "/challenges/missing-challenge",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "challenge-not-found" });
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
      userEmail: null,
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

  it("maps PATCH /challenges/:challengeId to the update challenge use case", async () => {
    const updateChallengeUseCase = createRecordingUpdateChallengeUseCase();
    const server = await createServer({ updateChallengeUseCase });

    const response = await server.inject({
      method: "PATCH",
      url: "/challenges/challenge-1",
      headers: {
        "x-user-id": "company-user",
        "x-organization-id": "org-company",
        "x-role": "company-admin",
      },
      payload: {
        title: " Updated scouting ",
        description: " Updated description. ",
      },
    });

    const command = readRecordedCommand({ commands: updateChallengeUseCase.commands });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(challengeDto);
    expect(command).toEqual({
      actor: {
        userId: "company-user",
        userEmail: null,
        organizationId: "org-company",
        role: "company-admin",
      },
      challengeId: "challenge-1",
      title: " Updated scouting ",
      description: " Updated description. ",
    });
  });

  it("maps missing challenge update failures to 404", async () => {
    const server = await createServer({
      updateChallengeUseCase: createRecordingUpdateChallengeUseCase({
        result: fail("challenge-not-found"),
      }),
    });

    const response = await server.inject({
      method: "PATCH",
      url: "/challenges/missing-challenge",
      payload: {
        title: "Updated scouting",
        description: "Updated description.",
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "challenge-not-found" });
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
        userEmail: null,
        organizationId: "org-company",
        role: "company-admin",
      },
      challengeId: "challenge-1",
      correlationId: "correlation-1",
    });
  });

  it("maps POST /challenges/:challengeId/archive to the archive use case", async () => {
    const archiveChallengeUseCase = createRecordingArchiveChallengeUseCase();
    const server = await createServer({ archiveChallengeUseCase });

    const response = await server.inject({
      method: "POST",
      url: "/challenges/challenge-1/archive",
      headers: {
        "x-user-id": "company-user",
        "x-organization-id": "org-company",
        "x-role": "company-admin",
      },
    });

    const command = readRecordedCommand({ commands: archiveChallengeUseCase.commands });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(archivedChallengeDto);
    expect(command).toEqual({
      actor: {
        userId: "company-user",
        userEmail: null,
        organizationId: "org-company",
        role: "company-admin",
      },
      challengeId: "challenge-1",
    });
  });

  it("maps POST /challenges/:challengeId/draft to the draft use case", async () => {
    const draftChallengeUseCase = createRecordingDraftChallengeUseCase();
    const server = await createServer({ draftChallengeUseCase });

    const response = await server.inject({
      method: "POST",
      url: "/challenges/challenge-1/draft",
      headers: {
        "x-user-id": "company-user",
        "x-organization-id": "org-company",
        "x-role": "company-admin",
      },
    });

    const command = readRecordedCommand({ commands: draftChallengeUseCase.commands });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(draftedChallengeDto);
    expect(command).toEqual({
      actor: {
        userId: "company-user",
        userEmail: null,
        organizationId: "org-company",
        role: "company-admin",
      },
      challengeId: "challenge-1",
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

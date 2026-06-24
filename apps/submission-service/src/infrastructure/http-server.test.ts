import type { ActorContext, SubmissionDecisionAuditDto, SubmissionDto } from "@sparkflow/contracts";
import { fail, succeed } from "@sparkflow/result";
import { afterEach, describe, expect, it } from "vitest";
import type {
  CreateSubmissionCommand,
  CreateSubmissionUseCase,
} from "../application/create-submission.use-case.js";
import type {
  DecideSubmissionCommand,
  DecideSubmissionUseCase,
} from "../application/decide-submission.use-case.js";
import type { ListMySubmissionsUseCase } from "../application/list-my-submissions.use-case.js";
import type { ListSubmissionDecisionAuditsUseCase } from "../application/list-submission-decision-audits.use-case.js";
import type { ListSubmissionsUseCase } from "../application/list-submissions.use-case.js";
import { buildSubmissionHttpServer } from "./http-server.js";

const submissionDto: SubmissionDto = {
  id: "submission-1",
  challengeId: "challenge-1",
  startupOrganizationId: "org-startup",
  summary: "A strong proposal",
  status: "submitted",
  createdAt: "2026-06-16T10:00:00.000Z",
  decidedAt: null,
};

const acceptedSubmissionDto: SubmissionDto = {
  ...submissionDto,
  status: "accepted",
  decidedAt: "2026-06-16T11:00:00.000Z",
};

const rejectedSubmissionDto: SubmissionDto = {
  ...submissionDto,
  status: "rejected",
  decidedAt: "2026-06-16T11:00:00.000Z",
};

const selectedSubmissionDto: SubmissionDto = {
  ...submissionDto,
  status: "selected",
  decidedAt: "2026-06-16T12:00:00.000Z",
};

const submissionDecisionAuditDto: SubmissionDecisionAuditDto = {
  id: "audit-1",
  submissionId: "submission-1",
  challengeId: "challenge-1",
  decidedByUserId: "company-user",
  decidedByUserEmail: "company-admin@sparkflow.test",
  decidedByOrganizationId: "org-company",
  decidedByRole: "company-admin",
  previousStatus: "submitted",
  newStatus: "accepted",
  decidedAt: "2026-06-16T11:00:00.000Z",
  reason: null,
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

const createRecordingCreateSubmissionUseCase = (input?: {
  readonly result?: Awaited<ReturnType<CreateSubmissionUseCase["execute"]>>;
}): CreateSubmissionUseCase & { readonly commands: CreateSubmissionCommand[] } => {
  const commands: CreateSubmissionCommand[] = [];

  return {
    commands,
    execute: async (command) => {
      commands.push(command);
      return input?.result ?? succeed(submissionDto);
    },
  };
};

const createRecordingDecideSubmissionUseCase = (input?: {
  readonly result?: Awaited<ReturnType<DecideSubmissionUseCase["execute"]>>;
}): DecideSubmissionUseCase & { readonly commands: DecideSubmissionCommand[] } => {
  const commands: DecideSubmissionCommand[] = [];

  return {
    commands,
    execute: async (command) => {
      commands.push(command);

      if (input?.result !== undefined) {
        return input.result;
      }

      if (command.decision === "accept") {
        return succeed(acceptedSubmissionDto);
      }

      if (command.decision === "reject") {
        return succeed(rejectedSubmissionDto);
      }

      return succeed(selectedSubmissionDto);
    },
  };
};

const createRecordingListSubmissionsUseCase = (input: {
  readonly submissions: readonly SubmissionDto[];
}): ListSubmissionsUseCase & {
  readonly commands: { readonly challengeId: string }[];
} => {
  const commands: { readonly challengeId: string }[] = [];

  return {
    commands,
    execute: async (command) => {
      commands.push(command);
      return input.submissions;
    },
  };
};

const createRecordingListMySubmissionsUseCase = (input: {
  readonly result: Awaited<ReturnType<ListMySubmissionsUseCase["execute"]>>;
}): ListMySubmissionsUseCase & {
  readonly commands: { readonly actor: ActorContext }[];
} => {
  const commands: { readonly actor: ActorContext }[] = [];

  return {
    commands,
    execute: async (command) => {
      commands.push(command);
      return input.result;
    },
  };
};

const createRecordingListSubmissionDecisionAuditsUseCase = (input: {
  readonly result: Awaited<ReturnType<ListSubmissionDecisionAuditsUseCase["execute"]>>;
}): ListSubmissionDecisionAuditsUseCase & {
  readonly commands: { readonly actor: ActorContext; readonly submissionId: string }[];
} => {
  const commands: { readonly actor: ActorContext; readonly submissionId: string }[] = [];

  return {
    commands,
    execute: async (command) => {
      commands.push(command);
      return input.result;
    },
  };
};

const createServer = async (input?: {
  readonly createSubmissionUseCase?: CreateSubmissionUseCase;
  readonly decideSubmissionUseCase?: DecideSubmissionUseCase;
  readonly listSubmissionDecisionAuditsUseCase?: ListSubmissionDecisionAuditsUseCase;
  readonly listMySubmissionsUseCase?: ListMySubmissionsUseCase;
  readonly listSubmissionsUseCase?: ListSubmissionsUseCase;
}) => {
  const server = await buildSubmissionHttpServer({
    createSubmissionUseCase:
      input?.createSubmissionUseCase ?? createRecordingCreateSubmissionUseCase(),
    decideSubmissionUseCase:
      input?.decideSubmissionUseCase ?? createRecordingDecideSubmissionUseCase(),
    listSubmissionDecisionAuditsUseCase:
      input?.listSubmissionDecisionAuditsUseCase ??
      createRecordingListSubmissionDecisionAuditsUseCase({ result: succeed([]) }),
    listMySubmissionsUseCase:
      input?.listMySubmissionsUseCase ??
      createRecordingListMySubmissionsUseCase({ result: succeed([]) }),
    listSubmissionsUseCase:
      input?.listSubmissionsUseCase ?? createRecordingListSubmissionsUseCase({ submissions: [] }),
  });

  openServers.push(server);

  return server;
};

afterEach(async () => {
  const serversToClose = [...openServers];
  openServers.length = 0;

  await Promise.all(serversToClose.map((server) => server.close()));
});

describe("buildSubmissionHttpServer", () => {
  it("lists submissions for the current startup actor", async () => {
    const listMySubmissionsUseCase = createRecordingListMySubmissionsUseCase({
      result: succeed([submissionDto]),
    });
    const server = await createServer({ listMySubmissionsUseCase });

    const response = await server.inject({
      method: "GET",
      url: "/me/submissions",
      headers: {
        "x-user-id": "startup-user",
        "x-user-email": "startup@sparkflow.test",
        "x-organization-id": "org-startup",
        "x-role": "startup-member",
      },
    });

    const command = readRecordedCommand({ commands: listMySubmissionsUseCase.commands });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([submissionDto]);
    expect(command).toEqual({
      actor: {
        userId: "startup-user",
        userEmail: "startup@sparkflow.test",
        organizationId: "org-startup",
        role: "startup-member",
      },
    });
  });

  it("maps current startup submission failures to 403", async () => {
    const server = await createServer({
      listMySubmissionsUseCase: createRecordingListMySubmissionsUseCase({
        result: fail("forbidden"),
      }),
    });

    const response = await server.inject({
      method: "GET",
      url: "/me/submissions",
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "forbidden" });
  });

  it("lists submissions for a challenge through the list use case", async () => {
    const listSubmissionsUseCase = createRecordingListSubmissionsUseCase({
      submissions: [submissionDto],
    });
    const server = await createServer({ listSubmissionsUseCase });

    const response = await server.inject({
      method: "GET",
      url: "/challenges/challenge-1/submissions",
    });

    const command = readRecordedCommand({ commands: listSubmissionsUseCase.commands });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([submissionDto]);
    expect(command).toEqual({ challengeId: "challenge-1" });
  });

  it("lists decision audits for a submission through the audit use case", async () => {
    const listSubmissionDecisionAuditsUseCase = createRecordingListSubmissionDecisionAuditsUseCase({
      result: succeed([submissionDecisionAuditDto]),
    });
    const server = await createServer({ listSubmissionDecisionAuditsUseCase });

    const response = await server.inject({
      method: "GET",
      url: "/submissions/submission-1/decision-audits",
      headers: {
        "x-user-id": "company-user",
        "x-user-email": "company-admin@sparkflow.test",
        "x-organization-id": "org-company",
        "x-role": "company-admin",
      },
    });

    const command = readRecordedCommand({
      commands: listSubmissionDecisionAuditsUseCase.commands,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([submissionDecisionAuditDto]);
    expect(command).toEqual({
      actor: {
        userId: "company-user",
        userEmail: "company-admin@sparkflow.test",
        organizationId: "org-company",
        role: "company-admin",
      },
      submissionId: "submission-1",
    });
  });

  it("maps decision audit failures to 403", async () => {
    const server = await createServer({
      listSubmissionDecisionAuditsUseCase: createRecordingListSubmissionDecisionAuditsUseCase({
        result: fail("forbidden"),
      }),
    });

    const response = await server.inject({
      method: "GET",
      url: "/submissions/submission-1/decision-audits",
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "forbidden" });
  });

  it("maps POST /challenges/:challengeId/submissions to the create submission use case", async () => {
    const createSubmissionUseCase = createRecordingCreateSubmissionUseCase();
    const server = await createServer({ createSubmissionUseCase });

    const response = await server.inject({
      method: "POST",
      url: "/challenges/challenge-1/submissions",
      headers: {
        "x-correlation-id": "correlation-1",
        "x-user-id": "startup-user",
        "x-user-email": "startup@sparkflow.test",
        "x-organization-id": "org-startup",
        "x-role": "startup-member",
      },
      payload: {
        summary: " A strong proposal ",
      },
    });

    const command = readRecordedCommand({ commands: createSubmissionUseCase.commands });
    const actor: ActorContext = {
      userId: "startup-user",
      userEmail: "startup@sparkflow.test",
      organizationId: "org-startup",
      role: "startup-member",
    };

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(submissionDto);
    expect(command).toEqual({
      actor,
      challengeId: "challenge-1",
      summary: " A strong proposal ",
      correlationId: "correlation-1",
    });
  });

  it("maps create submission failures to HTTP status codes", async () => {
    const server = await createServer({
      createSubmissionUseCase: createRecordingCreateSubmissionUseCase({
        result: fail("submission-summary-required"),
      }),
    });

    const response = await server.inject({
      method: "POST",
      url: "/challenges/challenge-1/submissions",
      payload: {
        summary: "",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "submission-summary-required" });
  });

  it("maps POST /submissions/:submissionId/accept to an accept decision", async () => {
    const decideSubmissionUseCase = createRecordingDecideSubmissionUseCase();
    const server = await createServer({ decideSubmissionUseCase });

    const response = await server.inject({
      method: "POST",
      url: "/submissions/submission-1/accept",
      headers: {
        "x-correlation-id": "correlation-1",
        "x-user-id": "company-user",
        "x-user-email": "company-admin@sparkflow.test",
        "x-organization-id": "org-company",
        "x-role": "company-admin",
      },
    });

    const command = readRecordedCommand({ commands: decideSubmissionUseCase.commands });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(acceptedSubmissionDto);
    expect(command).toEqual({
      actor: {
        userId: "company-user",
        userEmail: "company-admin@sparkflow.test",
        organizationId: "org-company",
        role: "company-admin",
      },
      submissionId: "submission-1",
      decision: "accept",
      correlationId: "correlation-1",
    });
  });

  it("maps POST /submissions/:submissionId/reject to a reject decision", async () => {
    const decideSubmissionUseCase = createRecordingDecideSubmissionUseCase();
    const server = await createServer({ decideSubmissionUseCase });

    const response = await server.inject({
      method: "POST",
      url: "/submissions/submission-1/reject",
      headers: {
        "x-correlation-id": "correlation-2",
        "x-user-id": "company-user",
        "x-user-email": "company-admin@sparkflow.test",
        "x-organization-id": "org-company",
        "x-role": "company-admin",
      },
    });

    const command = readRecordedCommand({ commands: decideSubmissionUseCase.commands });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(rejectedSubmissionDto);
    expect(command).toEqual({
      actor: {
        userId: "company-user",
        userEmail: "company-admin@sparkflow.test",
        organizationId: "org-company",
        role: "company-admin",
      },
      submissionId: "submission-1",
      decision: "reject",
      correlationId: "correlation-2",
    });
  });

  it("maps POST /submissions/:submissionId/select to a select decision", async () => {
    const decideSubmissionUseCase = createRecordingDecideSubmissionUseCase();
    const server = await createServer({ decideSubmissionUseCase });

    const response = await server.inject({
      method: "POST",
      url: "/submissions/submission-1/select",
      headers: {
        "x-correlation-id": "correlation-3",
        "x-user-id": "company-user",
        "x-user-email": "company-admin@sparkflow.test",
        "x-organization-id": "org-company",
        "x-role": "company-admin",
      },
    });

    const command = readRecordedCommand({ commands: decideSubmissionUseCase.commands });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(selectedSubmissionDto);
    expect(command).toEqual({
      actor: {
        userId: "company-user",
        userEmail: "company-admin@sparkflow.test",
        organizationId: "org-company",
        role: "company-admin",
      },
      submissionId: "submission-1",
      decision: "select",
      correlationId: "correlation-3",
    });
  });

  it("maps missing submission decision failures to 404", async () => {
    const server = await createServer({
      decideSubmissionUseCase: createRecordingDecideSubmissionUseCase({
        result: fail("submission-not-found"),
      }),
    });

    const response = await server.inject({
      method: "POST",
      url: "/submissions/missing-submission/accept",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "submission-not-found" });
  });
});

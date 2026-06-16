import { afterEach, describe, expect, it } from "vitest";
import type { ListUsersUseCase } from "../application/list-users.use-case.js";
import type { User } from "../domain/user.js";
import { buildIdentityHttpServer } from "./http-server.js";

const users: readonly User[] = [
  {
    id: "user-company-admin",
    organizationId: "org-company",
    role: "company-admin",
    displayName: "Company admin",
  },
];

const openServers: { readonly close: () => Promise<void> }[] = [];

const createRecordingListUsersUseCase = (input: {
  readonly users: readonly User[];
}): ListUsersUseCase & { readonly callCount: () => number } => {
  let calls = 0;

  return {
    callCount: () => calls,
    execute: () => {
      calls += 1;
      return input.users;
    },
  };
};

const createServer = async (input?: { readonly listUsersUseCase?: ListUsersUseCase }) => {
  const server = await buildIdentityHttpServer({
    listUsersUseCase: input?.listUsersUseCase ?? createRecordingListUsersUseCase({ users: [] }),
  });

  openServers.push(server);

  return server;
};

afterEach(async () => {
  const serversToClose = [...openServers];
  openServers.length = 0;

  await Promise.all(serversToClose.map((server) => server.close()));
});

describe("buildIdentityHttpServer", () => {
  it("returns health without calling the list users use case", async () => {
    const listUsersUseCase = createRecordingListUsersUseCase({ users });
    const server = await createServer({ listUsersUseCase });

    const response = await server.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
    expect(listUsersUseCase.callCount()).toBe(0);
  });

  it("lists fake users through the list users use case", async () => {
    const listUsersUseCase = createRecordingListUsersUseCase({ users });
    const server = await createServer({ listUsersUseCase });

    const response = await server.inject({
      method: "GET",
      url: "/users",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(users);
    expect(listUsersUseCase.callCount()).toBe(1);
  });
});

import { seedUsers, type User } from "../domain/user.ts";

export type ListUsersUseCase = {
  readonly execute: () => readonly User[];
};

export const createListUsersUseCase = (): ListUsersUseCase => ({
  execute: () => seedUsers,
});

import type { Challenge } from "../domain/challenge.ts";
import type { DomainEvent } from "@sparkflow/contracts";

export type ChallengeRepository = {
  readonly save: (input: { readonly challenge: Challenge }) => Promise<void>;
  readonly findById: (input: { readonly challengeId: string }) => Promise<Challenge | null>;
  readonly findAll: () => Promise<readonly Challenge[]>;
};

export type EventPublisher = {
  readonly publish: (input: { readonly event: DomainEvent }) => Promise<void>;
};

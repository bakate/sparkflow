import type { ChallengeDto, DomainEvent } from "@sparkflow/contracts";
import type { Challenge } from "../domain/challenge.ts";

export type ChallengeRepository = {
  readonly save: (input: { readonly challenge: Challenge }) => Promise<void>;
  readonly findById: (input: { readonly challengeId: string }) => Promise<Challenge | null>;
  readonly findAll: () => Promise<readonly Challenge[]>;
};

export type EventPublisher = {
  readonly publish: (input: { readonly event: DomainEvent<ChallengeDto> }) => Promise<void>;
};

export type Clock = {
  readonly now: () => Date;
};

export type IdGenerator = {
  readonly generate: () => string;
};

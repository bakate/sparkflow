import type { DomainEvent } from "@sparkflow/contracts";
import type { Submission } from "../domain/submission.ts";

export type SubmissionRepository = {
  readonly save: (input: { readonly submission: Submission }) => Promise<void>;
  readonly findById: (input: { readonly submissionId: string }) => Promise<Submission | null>;
  readonly findByChallengeId: (input: {
    readonly challengeId: string;
  }) => Promise<readonly Submission[]>;
};

export type EventPublisher = {
  readonly publish: (input: { readonly event: DomainEvent }) => Promise<void>;
};

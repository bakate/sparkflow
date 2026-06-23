import type { DomainEvent, SubmissionDto } from "@sparkflow/contracts";
import type { Result } from "@sparkflow/result";
import type { Submission } from "../domain/submission.ts";

export type SubmissionPersistenceError = "challenge-already-selected";

export type SubmissionRepository = {
  readonly save: (input: {
    readonly submission: Submission;
  }) => Promise<Result<SubmissionPersistenceError, void>>;
  readonly findById: (input: { readonly submissionId: string }) => Promise<Submission | null>;
  readonly findByChallengeId: (input: {
    readonly challengeId: string;
  }) => Promise<readonly Submission[]>;
  readonly findByStartupOrganizationId: (input: {
    readonly startupOrganizationId: string;
  }) => Promise<readonly Submission[]>;
};

export type EventPublisher = {
  readonly publish: (input: { readonly event: DomainEvent<SubmissionDto> }) => Promise<void>;
};

export type Clock = {
  readonly now: () => Date;
};

export type IdGenerator = {
  readonly generate: () => string;
};

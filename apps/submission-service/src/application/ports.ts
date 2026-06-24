import type { CursorPageRequestDto, DomainEvent, SubmissionDto } from "@sparkflow/contracts";
import type { Result } from "@sparkflow/result";
import type { Submission, SubmissionDecisionAudit } from "../domain/submission.ts";

export type SubmissionPersistenceError = "challenge-already-selected";
export type CursorPage<TEntity> = {
  readonly items: readonly TEntity[];
  readonly nextCursor: string | null;
};

export type SubmissionRepository = {
  readonly save: (input: {
    readonly submission: Submission;
  }) => Promise<Result<SubmissionPersistenceError, void>>;
  readonly saveMany: (input: {
    readonly submissions: readonly Submission[];
  }) => Promise<Result<SubmissionPersistenceError, void>>;
  readonly saveDecision: (input: {
    readonly submissions: readonly Submission[];
    readonly audits: readonly SubmissionDecisionAudit[];
  }) => Promise<Result<SubmissionPersistenceError, void>>;
  readonly findById: (input: { readonly submissionId: string }) => Promise<Submission | null>;
  readonly findByChallengeId: (input: {
    readonly challengeId: string;
  }) => Promise<readonly Submission[]>;
  readonly findPageByChallengeId: (input: {
    readonly challengeId: string;
    readonly page: CursorPageRequestDto;
  }) => Promise<CursorPage<Submission>>;
  readonly findByStartupOrganizationId: (input: {
    readonly startupOrganizationId: string;
  }) => Promise<readonly Submission[]>;
  readonly findPageByStartupOrganizationId: (input: {
    readonly startupOrganizationId: string;
    readonly page: CursorPageRequestDto;
  }) => Promise<CursorPage<Submission>>;
  readonly findDecisionAuditsBySubmissionId: (input: {
    readonly submissionId: string;
  }) => Promise<readonly SubmissionDecisionAudit[]>;
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

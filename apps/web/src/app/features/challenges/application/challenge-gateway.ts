import { InjectionToken } from '@angular/core';
import type { CursorPageMetaDto } from '@sparkflow/contracts';
import type { ChallengeId, Result, SubmissionId } from '@shared/domain/result';
import type { Challenge } from '@features/challenges/domain/challenge';
import type { Submission, SubmissionDecisionAudit } from '@features/challenges/domain/submission';

export type ChallengeOpportunity = {
  readonly challenge: Challenge;
  readonly submission: Submission;
};

export type CursorPage<TItem> = {
  readonly items: readonly TItem[];
  readonly page: CursorPageMetaDto;
};

export type ChallengeFailure =
  | 'challenge-title-required'
  | 'challenge-description-required'
  | 'challenge-already-archived'
  | 'challenge-already-draft'
  | 'challenge-already-published'
  | 'challenge-selection-completed'
  | 'challenge-not-found'
  | 'challenge-already-selected'
  | 'submission-not-found'
  | 'submission-already-decided'
  | 'submission-not-shortlisted'
  | 'submission-summary-required'
  | 'forbidden'
  | 'network-error'
  | 'unexpected-error';

export type CreateChallengeCommand = {
  readonly title: string;
  readonly description: string;
};

export type UpdateChallengeCommand = {
  readonly challengeId: ChallengeId;
  readonly title: string;
  readonly description: string;
};

export type PublishChallengeCommand = {
  readonly challengeId: ChallengeId;
};

export type DraftChallengeCommand = {
  readonly challengeId: ChallengeId;
};

export type ArchiveChallengeCommand = {
  readonly challengeId: ChallengeId;
};

export type SubmitChallengeProposalCommand = {
  readonly challengeId: ChallengeId;
  readonly summary: string;
};

export type ListChallengeSubmissionsCommand = {
  readonly challengeId: ChallengeId;
  readonly cursor?: string | null | undefined;
};

export type ListMyOpportunitiesCommand = {
  readonly cursor?: string | null | undefined;
};

export type ListSubmissionDecisionAuditsCommand = {
  readonly challengeId: ChallengeId;
  readonly submissionId: SubmissionId;
};

export type DecideSubmissionCommand = {
  readonly challengeId: ChallengeId;
  readonly submissionId: SubmissionId;
  readonly reason?: string | null | undefined;
};

export type ChallengeGateway = {
  readonly listChallenges: () => Promise<Result<ChallengeFailure, readonly Challenge[]>>;
  readonly listMySubmissions: () => Promise<Result<ChallengeFailure, readonly Submission[]>>;
  readonly listMyOpportunities: (
    command?: ListMyOpportunitiesCommand,
  ) => Promise<Result<ChallengeFailure, CursorPage<ChallengeOpportunity>>>;
  readonly listChallengeSubmissions: (
    command: ListChallengeSubmissionsCommand,
  ) => Promise<Result<ChallengeFailure, CursorPage<Submission>>>;
  readonly listSubmissionDecisionAudits: (
    command: ListSubmissionDecisionAuditsCommand,
  ) => Promise<Result<ChallengeFailure, readonly SubmissionDecisionAudit[]>>;
  readonly createChallenge: (
    command: CreateChallengeCommand,
  ) => Promise<Result<ChallengeFailure, Challenge>>;
  readonly updateChallenge: (
    command: UpdateChallengeCommand,
  ) => Promise<Result<ChallengeFailure, Challenge>>;
  readonly publishChallenge: (
    command: PublishChallengeCommand,
  ) => Promise<Result<ChallengeFailure, Challenge>>;
  readonly draftChallenge: (
    command: DraftChallengeCommand,
  ) => Promise<Result<ChallengeFailure, Challenge>>;
  readonly archiveChallenge: (
    command: ArchiveChallengeCommand,
  ) => Promise<Result<ChallengeFailure, Challenge>>;
  readonly submitChallengeProposal: (
    command: SubmitChallengeProposalCommand,
  ) => Promise<Result<ChallengeFailure, Submission>>;
  readonly acceptSubmission: (
    command: DecideSubmissionCommand,
  ) => Promise<Result<ChallengeFailure, Submission>>;
  readonly rejectSubmission: (
    command: DecideSubmissionCommand,
  ) => Promise<Result<ChallengeFailure, Submission>>;
  readonly selectSubmission: (
    command: DecideSubmissionCommand,
  ) => Promise<Result<ChallengeFailure, Submission>>;
};

export const CHALLENGE_GATEWAY = new InjectionToken<ChallengeGateway>('CHALLENGE_GATEWAY');

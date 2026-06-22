import { InjectionToken } from '@angular/core';
import type { ChallengeId, Result, SubmissionId } from '@shared/domain/result';
import type { Challenge } from '@features/challenges/domain/challenge';
import type { Submission } from '@features/challenges/domain/submission';

export type ChallengeFailure =
  | 'challenge-title-required'
  | 'challenge-description-required'
  | 'challenge-already-archived'
  | 'challenge-already-draft'
  | 'challenge-already-published'
  | 'challenge-not-found'
  | 'submission-not-found'
  | 'submission-already-decided'
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
};

export type DecideSubmissionCommand = {
  readonly challengeId: ChallengeId;
  readonly submissionId: SubmissionId;
};

export type ChallengeGateway = {
  readonly listChallenges: () => Promise<Result<ChallengeFailure, readonly Challenge[]>>;
  readonly listMySubmissions: () => Promise<Result<ChallengeFailure, readonly Submission[]>>;
  readonly listChallengeSubmissions: (
    command: ListChallengeSubmissionsCommand,
  ) => Promise<Result<ChallengeFailure, readonly Submission[]>>;
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
};

export const CHALLENGE_GATEWAY = new InjectionToken<ChallengeGateway>('CHALLENGE_GATEWAY');

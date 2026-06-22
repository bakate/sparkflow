import { InjectionToken } from '@angular/core';
import type { ChallengeId, Result } from '@shared/domain/result';
import type { Challenge } from '@features/challenges/domain/challenge';

export type ChallengeFailure =
  | 'challenge-title-required'
  | 'challenge-description-required'
  | 'challenge-already-published'
  | 'challenge-not-found'
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

export type ChallengeGateway = {
  readonly listChallenges: () => Promise<Result<ChallengeFailure, readonly Challenge[]>>;
  readonly createChallenge: (
    command: CreateChallengeCommand,
  ) => Promise<Result<ChallengeFailure, Challenge>>;
  readonly updateChallenge: (
    command: UpdateChallengeCommand,
  ) => Promise<Result<ChallengeFailure, Challenge>>;
  readonly publishChallenge: (
    command: PublishChallengeCommand,
  ) => Promise<Result<ChallengeFailure, Challenge>>;
};

export const CHALLENGE_GATEWAY = new InjectionToken<ChallengeGateway>('CHALLENGE_GATEWAY');

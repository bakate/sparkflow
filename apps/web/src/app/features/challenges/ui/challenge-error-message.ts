import type { ChallengeFailure } from '../application/challenge-gateway';

const errorMessages: Record<ChallengeFailure, string> = {
  'challenge-title-required': 'Title is required.',
  'challenge-description-required': 'Description is required.',
  'challenge-already-archived': 'Challenge is already archived.',
  'challenge-already-draft': 'Challenge is already a draft.',
  'challenge-already-published': 'Challenge is already published.',
  'challenge-not-found': 'Challenge was not found.',
  'submission-not-found': 'Submission was not found.',
  'submission-already-decided': 'Submission has already been decided.',
  'submission-not-shortlisted': 'Submission must be shortlisted before final selection.',
  'submission-summary-required': 'Summary is required.',
  forbidden: 'You are not allowed to perform this action.',
  'network-error': 'API gateway is unreachable.',
  'unexpected-error': 'Unexpected challenge error.',
};

export const challengeErrorMessage = (input: {
  readonly error: ChallengeFailure | null;
}): string => (input.error === null ? '' : errorMessages[input.error]);

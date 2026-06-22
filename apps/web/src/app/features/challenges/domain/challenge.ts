import type { ChallengeStatus } from '@sparkflow/contracts';
import { ChallengeId } from '@shared/domain/result';

export type ChallengeActor = {
  readonly organizationId: string;
  readonly role: 'company-admin' | 'reviewer' | 'startup-member';
};

export type Challenge = {
  readonly id: ChallengeId;
  readonly title: string;
  readonly description: string;
  readonly ownerOrganizationId: string;
  readonly status: ChallengeStatus;
  readonly createdAt: Date;
  readonly publishedAt: Date | null;
};

export const canPublishChallenge = (input: { readonly challenge: Challenge }): boolean =>
  input.challenge.status === 'draft';

export const canEditChallenge = (input: {
  readonly actor: ChallengeActor;
  readonly challenge: Challenge;
}): boolean =>
  input.actor.role === 'company-admin' &&
  input.actor.organizationId === input.challenge.ownerOrganizationId;

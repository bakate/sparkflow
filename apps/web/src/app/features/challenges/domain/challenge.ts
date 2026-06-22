import type { ActorContext, ChallengeStatus } from '@sparkflow/contracts';
import { ChallengeId } from '@shared/domain/result';

export type ChallengeActor = Pick<ActorContext, 'organizationId' | 'role'>;

export type Challenge = {
  readonly id: ChallengeId;
  readonly title: string;
  readonly description: string;
  readonly ownerOrganizationId: string;
  readonly status: ChallengeStatus;
  readonly createdAt: Date;
  readonly publishedAt: Date | null;
};

export const canCreateChallenge = (input: { readonly actor: ChallengeActor }): boolean =>
  input.actor.role === 'company-admin';

export const canPublishChallenge = (input: { readonly challenge: Challenge }): boolean =>
  input.challenge.status === 'draft';

export const canEditChallenge = (input: {
  readonly actor: ChallengeActor;
  readonly challenge: Challenge;
}): boolean =>
  input.actor.role === 'company-admin' &&
  input.actor.organizationId === input.challenge.ownerOrganizationId;

export const canSubmitChallengeProposal = (input: {
  readonly actor: ChallengeActor;
  readonly challenge: Challenge;
}): boolean => input.actor.role === 'startup-member' && input.challenge.status === 'published';

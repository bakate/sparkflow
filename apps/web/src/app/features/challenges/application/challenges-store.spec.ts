import { TestBed } from '@angular/core/testing';
import { AuthSession } from '@shared/auth/auth-session';
import { describe, expect, it } from 'vitest';
import { fail, type ChallengeId, type SubmissionId, succeed } from '../../../shared/domain/result';
import type { Challenge } from '../domain/challenge';
import type { Submission } from '../domain/submission';
import { CHALLENGE_GATEWAY, type ChallengeGateway } from './challenge-gateway';
import { ChallengesStore } from './challenges-store';

describe('ChallengesStore', () => {
  it('loads challenges from the gateway', async () => {
    const challenge = createChallenge({ id: 'challenge-1' });
    const store = createStore({
      challengeGateway: {
        listChallenges: async () => succeed([challenge]),
        listMySubmissions: async () => succeed([]),
        createChallenge: async () => fail('unexpected-error'),
        updateChallenge: async () => fail('unexpected-error'),
        publishChallenge: async () => fail('unexpected-error'),
        submitChallengeProposal: async () => fail('unexpected-error'),
      },
    });

    await expect.poll(() => store.challenges()).toEqual([challenge]);
    expect(store.draftCount()).toBe(1);
  });

  it('adds created challenges first', async () => {
    const existingChallenge = createChallenge({ id: 'challenge-1' });
    const createdChallenge = createChallenge({ id: 'challenge-2' });
    const store = createStore({
      challengeGateway: {
        listChallenges: async () => succeed([existingChallenge]),
        listMySubmissions: async () => succeed([]),
        createChallenge: async () => succeed(createdChallenge),
        updateChallenge: async () => fail('unexpected-error'),
        publishChallenge: async () => fail('unexpected-error'),
        submitChallengeProposal: async () => fail('unexpected-error'),
      },
    });

    await expect.poll(() => store.challenges()).toEqual([existingChallenge]);
    const result = await store.createChallenge({
      title: createdChallenge.title,
      description: createdChallenge.description,
    });

    expect(result.ok).toBe(true);
    expect(store.challenges()).toEqual([createdChallenge, existingChallenge]);
  });

  it('replaces updated challenges', async () => {
    const existingChallenge = createChallenge({ id: 'challenge-1' });
    const updatedChallenge = {
      ...existingChallenge,
      title: 'Updated challenge',
      description: 'Updated description',
    };
    const store = createStore({
      challengeGateway: {
        listChallenges: async () => succeed([existingChallenge]),
        listMySubmissions: async () => succeed([]),
        createChallenge: async () => fail('unexpected-error'),
        updateChallenge: async () => succeed(updatedChallenge),
        publishChallenge: async () => fail('unexpected-error'),
        submitChallengeProposal: async () => fail('unexpected-error'),
      },
    });

    await expect.poll(() => store.challenges()).toEqual([existingChallenge]);
    const result = await store.updateChallenge({
      challengeId: existingChallenge.id,
      title: updatedChallenge.title,
      description: updatedChallenge.description,
    });

    expect(result.ok).toBe(true);
    expect(store.challenges()).toEqual([updatedChallenge]);
  });

  it('exposes gateway failures', async () => {
    const store = createStore({
      challengeGateway: {
        listChallenges: async () => fail('network-error'),
        listMySubmissions: async () => succeed([]),
        createChallenge: async () => fail('unexpected-error'),
        updateChallenge: async () => fail('unexpected-error'),
        publishChallenge: async () => fail('unexpected-error'),
        submitChallengeProposal: async () => fail('unexpected-error'),
      },
    });

    await expect.poll(() => store.error()).toBe('network-error');
  });

  it('submits a proposal for a challenge', async () => {
    const challenge = createChallenge({ id: 'challenge-1' });
    const submission = createSubmission({ challengeId: challenge.id });
    const store = createStore({
      challengeGateway: {
        listChallenges: async () => succeed([challenge]),
        listMySubmissions: async () => succeed([]),
        createChallenge: async () => fail('unexpected-error'),
        updateChallenge: async () => fail('unexpected-error'),
        publishChallenge: async () => fail('unexpected-error'),
        submitChallengeProposal: async () => succeed(submission),
      },
    });

    const result = await store.submitChallengeProposal({
      challengeId: challenge.id,
      summary: submission.summary,
    });

    expect(result).toEqual(succeed(submission));
    expect(store.isSubmittingProposal({ challengeId: challenge.id })).toBe(false);
    expect(store.hasSubmittedProposal({ challengeId: challenge.id })).toBe(true);
  });
});

const createStore = (input: { readonly challengeGateway: ChallengeGateway }): ChallengesStore => {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      ChallengesStore,
      {
        provide: CHALLENGE_GATEWAY,
        useValue: input.challengeGateway,
      },
    ],
  });

  TestBed.inject(AuthSession).replaceAccessToken({ accessToken: createStartupAccessToken() });

  return TestBed.inject(ChallengesStore);
};

const createChallenge = (input: { readonly id: string }): Challenge => ({
  id: input.id as ChallengeId,
  title: `Challenge ${input.id}`,
  description: `Description ${input.id}`,
  ownerOrganizationId: 'org-company',
  status: 'draft',
  createdAt: new Date('2026-06-21T10:00:00.000Z'),
  publishedAt: null,
});

const createSubmission = (input: { readonly challengeId: ChallengeId }): Submission => ({
  id: 'submission-1' as SubmissionId,
  challengeId: input.challengeId,
  startupOrganizationId: 'org-startup',
  summary: 'A serious implementation proposal.',
  status: 'submitted',
  createdAt: new Date('2026-06-22T10:00:00.000Z'),
  decidedAt: null,
});

const createStartupAccessToken = (): string => {
  const payload = {
    sub: 'user-startup',
    organization_id: 'org-startup',
    realm_access: {
      roles: ['startup-member'],
    },
  };

  return `header.${btoa(JSON.stringify(payload))}.signature`;
};

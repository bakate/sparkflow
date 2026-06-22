import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { fail, type ChallengeId, succeed } from '../../../shared/domain/result';
import type { Challenge } from '../domain/challenge';
import { CHALLENGE_GATEWAY, type ChallengeGateway } from './challenge-gateway';
import { ChallengesStore } from './challenges-store';

describe('ChallengesStore', () => {
  it('loads challenges from the gateway', async () => {
    const challenge = createChallenge({ id: 'challenge-1' });
    const store = createStore({
      challengeGateway: {
        listChallenges: async () => succeed([challenge]),
        createChallenge: async () => fail('unexpected-error'),
        updateChallenge: async () => fail('unexpected-error'),
        publishChallenge: async () => fail('unexpected-error'),
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
        createChallenge: async () => succeed(createdChallenge),
        updateChallenge: async () => fail('unexpected-error'),
        publishChallenge: async () => fail('unexpected-error'),
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
        createChallenge: async () => fail('unexpected-error'),
        updateChallenge: async () => succeed(updatedChallenge),
        publishChallenge: async () => fail('unexpected-error'),
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
        createChallenge: async () => fail('unexpected-error'),
        updateChallenge: async () => fail('unexpected-error'),
        publishChallenge: async () => fail('unexpected-error'),
      },
    });

    await expect.poll(() => store.error()).toBe('network-error');
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

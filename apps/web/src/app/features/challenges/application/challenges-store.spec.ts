import { TestBed } from '@angular/core/testing';
import { AuthSession } from '@shared/auth/auth-session';
import { describe, expect, it } from 'vitest';
import { fail, type ChallengeId, type SubmissionId, succeed } from '../../../shared/domain/result';
import type { Challenge } from '../domain/challenge';
import type { Submission, SubmissionDecisionAudit } from '../domain/submission';
import { CHALLENGE_GATEWAY, type ChallengeGateway } from './challenge-gateway';
import { ChallengesStore } from './challenges-store';

describe('ChallengesStore', () => {
  it('loads challenges from the gateway', async () => {
    const challenge = createChallenge({ id: 'challenge-1' });
    const store = createStore({
      challengeGateway: {
        listChallenges: async () => succeed([challenge]),
        listMySubmissions: async () => succeed([]),
        listMyOpportunities: async () => succeed([]),
        listChallengeSubmissions: async () => succeed([]),
        listSubmissionDecisionAudits: async () => succeed([]),
        createChallenge: async () => fail('unexpected-error'),
        updateChallenge: async () => fail('unexpected-error'),
        publishChallenge: async () => fail('unexpected-error'),
        draftChallenge: async () => fail('unexpected-error'),
        archiveChallenge: async () => fail('unexpected-error'),
        submitChallengeProposal: async () => fail('unexpected-error'),
        acceptSubmission: async () => fail('unexpected-error'),
        rejectSubmission: async () => fail('unexpected-error'),
        selectSubmission: async () => fail('unexpected-error'),
      },
    });

    await expect.poll(() => store.challenges()).toEqual([challenge]);
    expect(store.draftCount()).toBe(1);
  });

  it('loads startup opportunity challenges from the dedicated projection', async () => {
    const openChallenge = createChallenge({ id: 'challenge-open', status: 'published' });
    const completedChallenge = createChallenge({
      id: 'challenge-completed',
      status: 'selection-completed',
    });
    const submission = createSubmission({ challengeId: completedChallenge.id });
    const store = createStore({
      challengeGateway: {
        listChallenges: async () => succeed([openChallenge]),
        listMySubmissions: async () => succeed([]),
        listMyOpportunities: async () => succeed([{ challenge: completedChallenge, submission }]),
        listChallengeSubmissions: async () => succeed([]),
        listSubmissionDecisionAudits: async () => succeed([]),
        createChallenge: async () => fail('unexpected-error'),
        updateChallenge: async () => fail('unexpected-error'),
        publishChallenge: async () => fail('unexpected-error'),
        draftChallenge: async () => fail('unexpected-error'),
        archiveChallenge: async () => fail('unexpected-error'),
        submitChallengeProposal: async () => fail('unexpected-error'),
        acceptSubmission: async () => fail('unexpected-error'),
        rejectSubmission: async () => fail('unexpected-error'),
        selectSubmission: async () => fail('unexpected-error'),
      },
    });

    await expect.poll(() => store.challenges()).toEqual([openChallenge]);
    await expect.poll(() => store.myOpportunityChallenges()).toEqual([completedChallenge]);
    expect(store.mySubmissions()).toEqual([submission]);
  });

  it('adds created challenges first', async () => {
    const existingChallenge = createChallenge({ id: 'challenge-1' });
    const createdChallenge = createChallenge({ id: 'challenge-2' });
    const store = createStore({
      challengeGateway: {
        listChallenges: async () => succeed([existingChallenge]),
        listMySubmissions: async () => succeed([]),
        listMyOpportunities: async () => succeed([]),
        listChallengeSubmissions: async () => succeed([]),
        listSubmissionDecisionAudits: async () => succeed([]),
        createChallenge: async () => succeed(createdChallenge),
        updateChallenge: async () => fail('unexpected-error'),
        publishChallenge: async () => fail('unexpected-error'),
        draftChallenge: async () => fail('unexpected-error'),
        archiveChallenge: async () => fail('unexpected-error'),
        submitChallengeProposal: async () => fail('unexpected-error'),
        acceptSubmission: async () => fail('unexpected-error'),
        rejectSubmission: async () => fail('unexpected-error'),
        selectSubmission: async () => fail('unexpected-error'),
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
        listMyOpportunities: async () => succeed([]),
        listChallengeSubmissions: async () => succeed([]),
        listSubmissionDecisionAudits: async () => succeed([]),
        createChallenge: async () => fail('unexpected-error'),
        updateChallenge: async () => succeed(updatedChallenge),
        publishChallenge: async () => fail('unexpected-error'),
        draftChallenge: async () => fail('unexpected-error'),
        archiveChallenge: async () => fail('unexpected-error'),
        submitChallengeProposal: async () => fail('unexpected-error'),
        acceptSubmission: async () => fail('unexpected-error'),
        rejectSubmission: async () => fail('unexpected-error'),
        selectSubmission: async () => fail('unexpected-error'),
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

  it('moves a published challenge back to draft', async () => {
    const publishedChallenge: Challenge = {
      ...createChallenge({ id: 'challenge-1' }),
      status: 'published',
      publishedAt: new Date('2026-06-21T11:00:00.000Z'),
    };
    const draftChallenge: Challenge = {
      ...publishedChallenge,
      status: 'draft',
      publishedAt: null,
    };
    const store = createStore({
      challengeGateway: {
        listChallenges: async () => succeed([publishedChallenge]),
        listMySubmissions: async () => succeed([]),
        listMyOpportunities: async () => succeed([]),
        listChallengeSubmissions: async () => succeed([]),
        listSubmissionDecisionAudits: async () => succeed([]),
        createChallenge: async () => fail('unexpected-error'),
        updateChallenge: async () => fail('unexpected-error'),
        publishChallenge: async () => fail('unexpected-error'),
        draftChallenge: async () => succeed(draftChallenge),
        archiveChallenge: async () => fail('unexpected-error'),
        submitChallengeProposal: async () => fail('unexpected-error'),
        acceptSubmission: async () => fail('unexpected-error'),
        rejectSubmission: async () => fail('unexpected-error'),
        selectSubmission: async () => fail('unexpected-error'),
      },
    });

    await expect.poll(() => store.challenges()).toEqual([publishedChallenge]);
    const result = await store.draftChallenge({ challengeId: publishedChallenge.id });

    expect(result).toEqual(succeed(draftChallenge));
    expect(store.isDrafting({ challengeId: publishedChallenge.id })).toBe(false);
    expect(store.challenges()).toEqual([draftChallenge]);
  });

  it('exposes gateway failures', async () => {
    const store = createStore({
      challengeGateway: {
        listChallenges: async () => fail('network-error'),
        listMySubmissions: async () => succeed([]),
        listMyOpportunities: async () => succeed([]),
        listChallengeSubmissions: async () => succeed([]),
        listSubmissionDecisionAudits: async () => succeed([]),
        createChallenge: async () => fail('unexpected-error'),
        updateChallenge: async () => fail('unexpected-error'),
        publishChallenge: async () => fail('unexpected-error'),
        draftChallenge: async () => fail('unexpected-error'),
        archiveChallenge: async () => fail('unexpected-error'),
        submitChallengeProposal: async () => fail('unexpected-error'),
        acceptSubmission: async () => fail('unexpected-error'),
        rejectSubmission: async () => fail('unexpected-error'),
        selectSubmission: async () => fail('unexpected-error'),
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
        listMyOpportunities: async () => succeed([]),
        listChallengeSubmissions: async () => succeed([]),
        listSubmissionDecisionAudits: async () => succeed([]),
        createChallenge: async () => fail('unexpected-error'),
        updateChallenge: async () => fail('unexpected-error'),
        publishChallenge: async () => fail('unexpected-error'),
        draftChallenge: async () => fail('unexpected-error'),
        archiveChallenge: async () => fail('unexpected-error'),
        submitChallengeProposal: async () => succeed(submission),
        acceptSubmission: async () => fail('unexpected-error'),
        rejectSubmission: async () => fail('unexpected-error'),
        selectSubmission: async () => fail('unexpected-error'),
      },
    });

    await expect.poll(() => store.challenges()).toEqual([challenge]);
    const result = await store.submitChallengeProposal({
      challengeId: challenge.id,
      summary: submission.summary,
    });

    expect(result).toEqual(succeed(submission));
    expect(store.isSubmittingProposal({ challengeId: challenge.id })).toBe(false);
    expect(store.hasSubmittedProposal({ challengeId: challenge.id })).toBe(true);
  });

  it('loads and accepts challenge submissions', async () => {
    const challenge = createChallenge({ id: 'challenge-1' });
    const submission = createSubmission({ challengeId: challenge.id });
    const acceptedSubmission: Submission = {
      ...submission,
      status: 'accepted',
      decidedAt: new Date('2026-06-22T11:00:00.000Z'),
    };
    const store = createStore({
      challengeGateway: {
        listChallenges: async () => succeed([challenge]),
        listMySubmissions: async () => succeed([]),
        listMyOpportunities: async () => succeed([]),
        listChallengeSubmissions: async () => succeed([submission]),
        listSubmissionDecisionAudits: async () => succeed([]),
        createChallenge: async () => fail('unexpected-error'),
        updateChallenge: async () => fail('unexpected-error'),
        publishChallenge: async () => fail('unexpected-error'),
        draftChallenge: async () => fail('unexpected-error'),
        archiveChallenge: async () => fail('unexpected-error'),
        submitChallengeProposal: async () => fail('unexpected-error'),
        acceptSubmission: async () => succeed(acceptedSubmission),
        rejectSubmission: async () => fail('unexpected-error'),
        selectSubmission: async () => fail('unexpected-error'),
      },
    });

    await store.loadChallengeSubmissions({ challengeId: challenge.id });
    const result = await store.acceptSubmission({
      challengeId: challenge.id,
      submissionId: submission.id,
    });

    expect(result).toEqual(succeed(acceptedSubmission));
    expect(store.isDecidingSubmission({ submissionId: submission.id })).toBe(false);
    expect(store.submissionsForChallenge({ challengeId: challenge.id })).toEqual([
      acceptedSubmission,
    ]);
  });

  it('loads decision audits for a submission', async () => {
    const challenge = createChallenge({ id: 'challenge-1' });
    const submission = createSubmission({ challengeId: challenge.id });
    const audit = createSubmissionDecisionAudit({
      challengeId: challenge.id,
      submissionId: submission.id,
    });
    const store = createStore({
      challengeGateway: {
        listChallenges: async () => succeed([challenge]),
        listMySubmissions: async () => succeed([]),
        listMyOpportunities: async () => succeed([]),
        listChallengeSubmissions: async () => succeed([submission]),
        listSubmissionDecisionAudits: async () => succeed([audit]),
        createChallenge: async () => fail('unexpected-error'),
        updateChallenge: async () => fail('unexpected-error'),
        publishChallenge: async () => fail('unexpected-error'),
        draftChallenge: async () => fail('unexpected-error'),
        archiveChallenge: async () => fail('unexpected-error'),
        submitChallengeProposal: async () => fail('unexpected-error'),
        acceptSubmission: async () => fail('unexpected-error'),
        rejectSubmission: async () => fail('unexpected-error'),
        selectSubmission: async () => fail('unexpected-error'),
      },
    });

    const result = await store.loadSubmissionDecisionAudits({
      challengeId: challenge.id,
      submissionId: submission.id,
    });

    expect(result).toEqual(succeed([audit]));
    expect(store.isLoadingSubmissionDecisionAudits({ submissionId: submission.id })).toBe(false);
    expect(store.decisionAuditsForSubmission({ submissionId: submission.id })).toEqual([audit]);
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

const createChallenge = (input: {
  readonly id: string;
  readonly status?: Challenge['status'];
}): Challenge => ({
  id: input.id as ChallengeId,
  title: `Challenge ${input.id}`,
  description: `Description ${input.id}`,
  ownerOrganizationId: 'org-company',
  status: input.status ?? 'draft',
  createdAt: new Date('2026-06-21T10:00:00.000Z'),
  publishedAt:
    input.status === undefined || input.status === 'draft'
      ? null
      : new Date('2026-06-21T11:00:00.000Z'),
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

const createSubmissionDecisionAudit = (input: {
  readonly challengeId: ChallengeId;
  readonly submissionId: SubmissionId;
}): SubmissionDecisionAudit => ({
  id: 'audit-1',
  submissionId: input.submissionId,
  challengeId: input.challengeId,
  decidedByUserId: 'user-company-admin',
  decidedByUserEmail: 'company-admin@sparkflow.test',
  decidedByOrganizationId: 'org-company',
  decidedByRole: 'company-admin',
  previousStatus: 'submitted',
  newStatus: 'accepted',
  decidedAt: new Date('2026-06-22T11:00:00.000Z'),
  reason: null,
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

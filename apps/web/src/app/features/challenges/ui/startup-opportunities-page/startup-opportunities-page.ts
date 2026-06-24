import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import type { ChallengeId, SubmissionId } from '@shared/domain/result';
import { CHALLENGE_GATEWAY, type ChallengeOpportunity } from '../../application/challenge-gateway';
import { ChallengesStore } from '../../application/challenges-store';
import type { Submission, SubmissionDecisionAudit } from '../../domain/submission';
import { HttpChallengeGateway } from '../../infrastructure/http-challenge-gateway';
import { challengeErrorMessage } from '../challenge-error-message';

@Component({
  selector: 'app-startup-opportunities-page',
  imports: [Button, Card, RouterLink, Tag],
  providers: [
    ChallengesStore,
    {
      provide: CHALLENGE_GATEWAY,
      useClass: HttpChallengeGateway,
    },
  ],
  templateUrl: './startup-opportunities-page.html',
})
export class StartupOpportunitiesPage {
  protected readonly store = inject(ChallengesStore);
  protected readonly activeFilter = signal<OpportunityFilter>('all');
  protected readonly opportunities = computed<readonly OpportunityViewModel[]>(() =>
    this.store
      .myOpportunities()
      .map((opportunity) =>
        toOpportunityViewModel({
          audits: this.store.decisionAuditsForSubmission({
            submissionId: opportunity.submission.id,
          }),
          isLoadingFeedback: this.store.isLoadingSubmissionDecisionAudits({
            submissionId: opportunity.submission.id,
          }),
          opportunity,
        }),
      )
      .sort(
        (leftOpportunity, rightOpportunity) =>
          opportunityRank({ opportunity: leftOpportunity }) -
            opportunityRank({ opportunity: rightOpportunity }) ||
          rightOpportunity.submittedAt.getTime() - leftOpportunity.submittedAt.getTime(),
      ),
  );
  protected readonly opportunitySummary = computed(() =>
    summarizeOpportunities({ opportunities: this.opportunities() }),
  );
  protected readonly filteredOpportunities = computed<readonly OpportunityViewModel[]>(() =>
    this.opportunities().filter((opportunity) =>
      opportunityMatchesFilter({
        opportunity,
        filter: this.activeFilter(),
      }),
    ),
  );
  protected readonly opportunityFilters = computed<readonly OpportunityFilterViewModel[]>(() =>
    opportunityFilterOptions.map((filterOption) => ({
      ...filterOption,
      count: this.opportunities().filter((opportunity) =>
        opportunityMatchesFilter({
          opportunity,
          filter: filterOption.value,
        }),
      ).length,
      selected: this.activeFilter() === filterOption.value,
    })),
  );

  constructor() {
    effect(() => {
      const auditLoadRequests = decisionAuditLoadRequestsForOpportunities({
        opportunities: this.store.myOpportunities(),
      });

      // Defer store writes triggered by the effect until the current signal read cycle is done.
      queueMicrotask(() => {
        void this.loadMissingDecisionAudits({ requests: auditLoadRequests });
      });
    });
  }

  protected reloadOpportunities(): void {
    this.store.reloadChallenges();
  }

  protected selectFilter(input: { readonly filter: OpportunityFilter }): void {
    this.activeFilter.set(input.filter);
  }

  protected emptyMessage(): string {
    if (this.store.myOpportunities().length === 0) {
      return 'No submitted opportunities yet.';
    }

    return emptyMessageForFilter({ filter: this.activeFilter() });
  }

  protected errorMessage(): string | null {
    const error = this.store.error();

    return error === null ? null : challengeErrorMessage({ error });
  }

  protected formatDate(input: { readonly date: Date }): string {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(input.date);
  }

  protected statusSeverity(input: {
    readonly status: Submission['status'];
  }): 'danger' | 'info' | 'secondary' | 'success' {
    if (input.status === 'selected') {
      return 'success';
    }

    if (input.status === 'accepted' || input.status === 'submitted') {
      return 'info';
    }

    if (input.status === 'rejected') {
      return 'danger';
    }

    return 'secondary';
  }

  private async loadMissingDecisionAudits(input: {
    readonly requests: readonly DecisionAuditLoadRequest[];
  }): Promise<void> {
    await Promise.all(
      input.requests.map((request) =>
        this.store.loadMissingSubmissionDecisionAudits({
          challengeId: request.challengeId,
          submissionIds: [request.submissionId],
        }),
      ),
    );
  }
}

type OpportunityViewModel = {
  readonly challengeTitle: string;
  readonly challengeDescription: string;
  readonly companyOrganizationId: string;
  readonly feedback: string | null;
  readonly isLoadingFeedback: boolean;
  readonly submissionId: SubmissionId;
  readonly status: Submission['status'];
  readonly statusDescription: string;
  readonly statusLabel: string;
  readonly submittedAt: Date;
  readonly summary: string;
  readonly decidedAt: Date | null;
};

type OpportunityFilter = 'all' | 'my-proposals' | 'results' | 'shortlisted';

type OpportunityFilterOption = {
  readonly label: string;
  readonly value: OpportunityFilter;
};

type OpportunityFilterViewModel = OpportunityFilterOption & {
  readonly count: number;
  readonly selected: boolean;
};

type OpportunitySummary = {
  readonly closed: number;
  readonly selected: number;
  readonly shortlisted: number;
  readonly submitted: number;
};

type DecisionAuditLoadRequest = {
  readonly challengeId: ChallengeId;
  readonly submissionId: SubmissionId;
};

const opportunityFilterOptions: readonly OpportunityFilterOption[] = [
  { label: 'All', value: 'all' },
  { label: 'My proposals', value: 'my-proposals' },
  { label: 'Shortlisted', value: 'shortlisted' },
  { label: 'Results / Closed', value: 'results' },
] as const;

const toOpportunityViewModel = (input: {
  readonly audits: readonly SubmissionDecisionAudit[];
  readonly isLoadingFeedback: boolean;
  readonly opportunity: ChallengeOpportunity;
}): OpportunityViewModel => {
  const latestReason = readLatestDecisionReason({ audits: input.audits });

  return {
    challengeTitle: input.opportunity.challenge.title,
    challengeDescription: input.opportunity.challenge.description,
    companyOrganizationId: input.opportunity.challenge.ownerOrganizationId,
    feedback: latestReason,
    isLoadingFeedback: input.isLoadingFeedback,
    submissionId: input.opportunity.submission.id,
    status: input.opportunity.submission.status,
    statusDescription: opportunityStatusDescription({
      status: input.opportunity.submission.status,
    }),
    statusLabel: opportunityStatusLabel({ status: input.opportunity.submission.status }),
    submittedAt: input.opportunity.submission.createdAt,
    summary: input.opportunity.submission.summary,
    decidedAt: input.opportunity.submission.decidedAt,
  };
};

const summarizeOpportunities = (input: {
  readonly opportunities: readonly OpportunityViewModel[];
}): OpportunitySummary => ({
  closed: input.opportunities.filter(
    (opportunity) => opportunity.status === 'not-selected' || opportunity.status === 'rejected',
  ).length,
  selected: input.opportunities.filter((opportunity) => opportunity.status === 'selected').length,
  shortlisted: input.opportunities.filter((opportunity) => opportunity.status === 'accepted')
    .length,
  submitted: input.opportunities.filter((opportunity) => opportunity.status === 'submitted').length,
});

const opportunityRank = (input: { readonly opportunity: OpportunityViewModel }): number => {
  const ranks: Record<Submission['status'], number> = {
    selected: 0,
    accepted: 1,
    submitted: 2,
    'not-selected': 3,
    rejected: 4,
  };

  return ranks[input.opportunity.status];
};

const opportunityStatusLabel = (input: { readonly status: Submission['status'] }): string => {
  const labels: Record<Submission['status'], string> = {
    accepted: 'Shortlisted',
    rejected: 'Not retained',
    selected: 'Selected for final project',
    submitted: 'Proposal sent',
    'not-selected': 'Not finally selected',
  };

  return labels[input.status];
};

const opportunityStatusDescription = (input: { readonly status: Submission['status'] }): string => {
  const descriptions: Record<Submission['status'], string> = {
    accepted: 'You are shortlisted for the next step.',
    rejected: 'The company did not retain this proposal.',
    selected: 'You are selected for the final project.',
    submitted: 'Proposal sent, waiting review.',
    'not-selected': 'Shortlisted, but not finally selected.',
  };

  return descriptions[input.status];
};

const readLatestDecisionReason = (input: {
  readonly audits: readonly SubmissionDecisionAudit[];
}): string | null => {
  const auditWithReason = [...input.audits]
    .sort((leftAudit, rightAudit) => rightAudit.decidedAt.getTime() - leftAudit.decidedAt.getTime())
    .find((audit) => audit.reason !== null);

  return auditWithReason?.reason ?? null;
};

const opportunityMatchesFilter = (input: {
  readonly opportunity: OpportunityViewModel;
  readonly filter: OpportunityFilter;
}): boolean => {
  if (input.filter === 'all') {
    return true;
  }

  if (input.filter === 'my-proposals') {
    return input.opportunity.status === 'submitted';
  }

  if (input.filter === 'shortlisted') {
    return input.opportunity.status === 'accepted';
  }

  return (
    input.opportunity.status === 'not-selected' ||
    input.opportunity.status === 'rejected' ||
    input.opportunity.status === 'selected'
  );
};

const emptyMessageForFilter = (input: { readonly filter: OpportunityFilter }): string => {
  if (input.filter === 'my-proposals') {
    return 'No proposals are waiting for review.';
  }

  if (input.filter === 'shortlisted') {
    return 'No shortlisted proposals yet.';
  }

  if (input.filter === 'results') {
    return 'No final results yet.';
  }

  return 'No opportunities match this filter.';
};

const decisionAuditLoadRequestsForOpportunities = (input: {
  readonly opportunities: readonly ChallengeOpportunity[];
}): readonly DecisionAuditLoadRequest[] =>
  input.opportunities
    .filter((opportunity) => opportunity.submission.status !== 'submitted')
    .map((opportunity) => ({
      challengeId: opportunity.challenge.id,
      submissionId: opportunity.submission.id,
    }));

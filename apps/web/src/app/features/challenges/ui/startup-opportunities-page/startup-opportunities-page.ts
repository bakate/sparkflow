import { Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { DataViewModule } from 'primeng/dataview';
import { Tag } from 'primeng/tag';
import type { ChallengeId, SubmissionId } from '@shared/domain/result';
import { EmptyState } from '@shared/ui/empty-state';
import { CHALLENGE_GATEWAY, type ChallengeOpportunity } from '../../application/challenge-gateway';
import { ChallengesStore } from '../../application/challenges-store';
import type { Submission, SubmissionDecisionAudit } from '../../domain/submission';
import { HttpChallengeGateway } from '../../infrastructure/http-challenge-gateway';
import { challengeErrorMessage } from '../challenge-error-message';

@Component({
  selector: 'app-startup-opportunities-page',
  imports: [Button, DataViewModule, EmptyState, RouterLink, Tag],
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly localPaginatorRows = 20;
  protected readonly activeFilter = signal<OpportunityFilter>('all');
  protected readonly focusedSubmissionId = signal<SubmissionId | null>(
    toSubmissionId({ value: this.route.snapshot.queryParamMap.get('submissionId') }),
  );
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
    filterVisibleOpportunities({
      focusedSubmissionId: this.focusedSubmissionId(),
      filter: this.activeFilter(),
      opportunities: this.opportunities(),
    }),
  );
  protected readonly dataViewOpportunities = computed(() => [...this.filteredOpportunities()]);
  protected readonly usesLocalPaginator = computed(
    () =>
      !this.store.hasMoreMyOpportunities() &&
      this.filteredOpportunities().length > this.localPaginatorRows,
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
      hasMore: this.store.hasMoreMyOpportunities(),
      selected: this.activeFilter() === filterOption.value,
    })),
  );

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((queryParamMap) => {
      this.focusedSubmissionId.set(toSubmissionId({ value: queryParamMap.get('submissionId') }));
    });

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

  protected async loadMoreOpportunities(): Promise<void> {
    await this.store.loadMoreMyOpportunities();
  }

  protected selectFilter(input: { readonly filter: OpportunityFilter }): void {
    this.activeFilter.set(input.filter);
    this.clearFocusedOpportunity();
  }

  protected clearFocusedOpportunity(): void {
    if (this.focusedSubmissionId() === null) {
      return;
    }

    void this.router.navigate(['/opportunities'], {
      queryParams: { submissionId: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected emptyMessage(): string {
    if (this.store.myOpportunities().length === 0) {
      return 'No submitted opportunities yet.';
    }

    if (this.focusedSubmissionId() !== null) {
      return 'This linked opportunity is not available for your startup.';
    }

    return emptyMessageForFilter({ filter: this.activeFilter() });
  }

  protected emptyTitle(): string {
    if (this.store.myOpportunities().length === 0) {
      return 'No opportunities yet';
    }

    if (this.focusedSubmissionId() !== null) {
      return 'Opportunity unavailable';
    }

    return 'No results for this filter';
  }

  protected opportunityCountLabel(input: { readonly count: number }): string {
    return `${input.count}${this.store.hasMoreMyOpportunities() ? '+' : ''}`;
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
  readonly hasMore: boolean;
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

const toSubmissionId = (input: { readonly value: string | null }): SubmissionId | null =>
  input.value === null || input.value.trim().length === 0
    ? null
    : (input.value.trim() as SubmissionId);

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

const filterVisibleOpportunities = (input: {
  readonly focusedSubmissionId: SubmissionId | null;
  readonly filter: OpportunityFilter;
  readonly opportunities: readonly OpportunityViewModel[];
}): readonly OpportunityViewModel[] => {
  if (input.focusedSubmissionId !== null) {
    return input.opportunities.filter(
      (opportunity) => opportunity.submissionId === input.focusedSubmissionId,
    );
  }

  return input.opportunities.filter((opportunity) =>
    opportunityMatchesFilter({
      opportunity,
      filter: input.filter,
    }),
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

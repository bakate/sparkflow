import { Component, computed, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import type { SubmissionId } from '@shared/domain/result';
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
  protected readonly opportunities = computed<readonly OpportunityViewModel[]>(() =>
    this.store
      .myOpportunities()
      .map((opportunity) => this.toOpportunityViewModel({ opportunity }))
      .sort(
        (leftOpportunity, rightOpportunity) =>
          this.opportunityRank({ opportunity: leftOpportunity }) -
            this.opportunityRank({ opportunity: rightOpportunity }) ||
          rightOpportunity.submittedAt.getTime() - leftOpportunity.submittedAt.getTime(),
      ),
  );
  protected readonly submittedCount = computed(
    () =>
      this.store
        .myOpportunities()
        .filter((opportunity) => opportunity.submission.status === 'submitted').length,
  );
  protected readonly shortlistedCount = computed(
    () =>
      this.store
        .myOpportunities()
        .filter((opportunity) => opportunity.submission.status === 'accepted').length,
  );
  protected readonly selectedCount = computed(
    () =>
      this.store
        .myOpportunities()
        .filter((opportunity) => opportunity.submission.status === 'selected').length,
  );
  protected readonly closedCount = computed(
    () =>
      this.store
        .myOpportunities()
        .filter(
          (opportunity) =>
            opportunity.submission.status === 'rejected' ||
            opportunity.submission.status === 'not-selected',
        ).length,
  );

  constructor() {
    effect(() => {
      const opportunities = this.store
        .myOpportunities()
        .filter((opportunity) => opportunity.submission.status !== 'submitted');

      queueMicrotask(() => {
        void Promise.all(
          opportunities.map((opportunity) =>
            this.store.loadMissingSubmissionDecisionAudits({
              challengeId: opportunity.challenge.id,
              submissionIds: [opportunity.submission.id],
            }),
          ),
        );
      });
    });
  }

  protected reloadOpportunities(): void {
    this.store.reloadChallenges();
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

  private toOpportunityViewModel(input: {
    readonly opportunity: ChallengeOpportunity;
  }): OpportunityViewModel {
    const audits = this.store.decisionAuditsForSubmission({
      submissionId: input.opportunity.submission.id,
    });
    const latestReason = readLatestDecisionReason({ audits });

    return {
      challengeTitle: input.opportunity.challenge.title,
      challengeDescription: input.opportunity.challenge.description,
      companyOrganizationId: input.opportunity.challenge.ownerOrganizationId,
      feedback: latestReason,
      isLoadingFeedback: this.store.isLoadingSubmissionDecisionAudits({
        submissionId: input.opportunity.submission.id,
      }),
      submissionId: input.opportunity.submission.id,
      status: input.opportunity.submission.status,
      statusLabel: opportunityStatusLabel({ status: input.opportunity.submission.status }),
      submittedAt: input.opportunity.submission.createdAt,
      summary: input.opportunity.submission.summary,
      decidedAt: input.opportunity.submission.decidedAt,
    };
  }

  private opportunityRank(input: { readonly opportunity: OpportunityViewModel }): number {
    const ranks: Record<Submission['status'], number> = {
      selected: 0,
      accepted: 1,
      submitted: 2,
      'not-selected': 3,
      rejected: 4,
    };

    return ranks[input.opportunity.status];
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
  readonly statusLabel: string;
  readonly submittedAt: Date;
  readonly summary: string;
  readonly decidedAt: Date | null;
};

const opportunityStatusLabel = (input: { readonly status: Submission['status'] }): string => {
  const labels: Record<Submission['status'], string> = {
    accepted: 'Shortlisted',
    rejected: 'Rejected',
    selected: 'Selected',
    submitted: 'Under review',
    'not-selected': 'Not selected',
  };

  return labels[input.status];
};

const readLatestDecisionReason = (input: {
  readonly audits: readonly SubmissionDecisionAudit[];
}): string | null => {
  const auditWithReason = [...input.audits]
    .sort((leftAudit, rightAudit) => rightAudit.decidedAt.getTime() - leftAudit.decidedAt.getTime())
    .find((audit) => audit.reason !== null);

  return auditWithReason?.reason ?? null;
};

import { Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Tag } from 'primeng/tag';
import type { ChallengeId, SubmissionId } from '@shared/domain/result';
import { CHALLENGE_GATEWAY, type ChallengeFailure } from '../../application/challenge-gateway';
import { ChallengesStore } from '../../application/challenges-store';
import type { Challenge } from '../../domain/challenge';
import { HttpChallengeGateway } from '../../infrastructure/http-challenge-gateway';
import { challengeErrorMessage } from '../challenge-error-message';
import { ChallengeStatusLabel } from '../challenge-status-label';
import { ChallengeSubmissionsReview } from '../challenge-submissions-review/challenge-submissions-review';
import type { Submission, SubmissionDecisionAudit } from '../../domain/submission';

@Component({
  selector: 'app-challenge-proposals-page',
  imports: [Button, ChallengeStatusLabel, ChallengeSubmissionsReview, Dialog, RouterLink, Tag],
  providers: [
    ChallengesStore,
    {
      provide: CHALLENGE_GATEWAY,
      useClass: HttpChallengeGateway,
    },
  ],
  templateUrl: './challenge-proposals-page.html',
})
export class ChallengeProposalsPage {
  protected readonly store = inject(ChallengesStore);
  private readonly messageService = inject(MessageService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly challengeId = signal<ChallengeId | null>(this.readChallengeId());
  protected readonly pendingReasonDecision = signal<PendingReasonDecision | null>(null);
  protected readonly decisionReason = signal('');
  protected readonly challenge = computed(() => this.findChallenge());
  protected readonly submissions = computed(() => {
    const challengeId = this.challengeId();

    return challengeId === null ? [] : this.store.submissionsForChallenge({ challengeId });
  });
  protected readonly pendingProposalCount = computed(
    () => this.submissions().filter((submission) => submission.status === 'submitted').length,
  );
  protected readonly totalProposalCount = computed(() => this.submissions().length);
  protected readonly acceptedProposalCount = computed(
    () => this.submissions().filter((submission) => submission.status === 'accepted').length,
  );
  protected readonly rejectedProposalCount = computed(
    () => this.submissions().filter((submission) => submission.status === 'rejected').length,
  );
  protected readonly selectedProposalCount = computed(
    () => this.submissions().filter((submission) => submission.status === 'selected').length,
  );
  protected readonly selectedSubmissions = computed(() =>
    this.submissions().filter((submission) => submission.status === 'selected'),
  );
  protected readonly hasFinalSelection = computed(() => this.selectedSubmissions().length > 0);
  protected readonly finalSelectionLocked = computed(
    () => this.hasFinalSelection() || this.challenge()?.status === 'selection-completed',
  );
  protected readonly activeDecisionCount = computed(
    () => this.pendingProposalCount() + this.acceptedProposalCount(),
  );
  protected readonly remainingSubmissions = computed(() =>
    this.submissions()
      .filter((submission) => submission.status !== 'selected')
      .sort(
        (leftSubmission, rightSubmission) =>
          this.submissionSortRank({ submission: leftSubmission }) -
          this.submissionSortRank({ submission: rightSubmission }),
      ),
  );
  protected readonly remainingProposalCount = computed(() => this.remainingSubmissions().length);
  protected readonly notSelectedProposalCount = computed(
    () => this.submissions().filter((submission) => submission.status === 'not-selected').length,
  );
  protected readonly decidedSubmissions = computed(() =>
    this.submissions().filter((submission) => submission.status !== 'submitted'),
  );
  protected readonly decisionAuditCount = computed(() =>
    this.decidedSubmissions().reduce(
      (auditCount, submission) =>
        auditCount + this.store.decisionAuditsForSubmission({ submissionId: submission.id }).length,
      0,
    ),
  );
  protected readonly loadingSubmissions = computed(() => {
    const challengeId = this.challengeId();

    return challengeId === null ? false : this.store.isLoadingChallengeSubmissions({ challengeId });
  });

  constructor() {
    effect(() => {
      const challengeId = this.challengeId();

      if (challengeId === null) {
        void this.router.navigate(['/challenges']);
        return;
      }

      queueMicrotask(() => {
        void this.store.loadChallengeSubmissions({ challengeId });
      });
    });

    effect(() => {
      const challengeId = this.challengeId();

      if (challengeId === null) {
        return;
      }

      const submissionIds = this.decidedSubmissions().map((submission) => submission.id);

      queueMicrotask(() => {
        void this.store.loadMissingSubmissionDecisionAudits({ challengeId, submissionIds });
      });
    });
  }

  protected async acceptSubmission(input: { readonly submissionId: SubmissionId }): Promise<void> {
    await this.decideSubmission({
      submissionId: input.submissionId,
      decision: 'accept',
      successSummary: 'Proposal shortlisted',
    });
  }

  protected async rejectSubmission(input: { readonly submissionId: SubmissionId }): Promise<void> {
    this.openDecisionReasonDialog({
      submissionId: input.submissionId,
      decision: 'reject',
      successSummary: 'Proposal rejected',
    });
  }

  protected async selectSubmission(input: { readonly submissionId: SubmissionId }): Promise<void> {
    this.openDecisionReasonDialog({
      submissionId: input.submissionId,
      decision: 'select',
      successSummary: 'Final startup selected',
    });
  }

  protected updateDecisionReason(event: Event): void {
    const target = event.target;

    if (!(target instanceof HTMLTextAreaElement)) {
      return;
    }

    this.decisionReason.set(target.value);
  }

  protected closeDecisionReasonDialog(): void {
    this.pendingReasonDecision.set(null);
    this.decisionReason.set('');
  }

  protected setDecisionReasonDialogVisible(input: { readonly visible: boolean }): void {
    if (input.visible) {
      return;
    }

    this.closeDecisionReasonDialog();
  }

  protected async confirmDecisionReason(): Promise<void> {
    const pendingDecision = this.pendingReasonDecision();

    if (pendingDecision === null) {
      return;
    }

    await this.decideSubmission({
      ...pendingDecision,
      reason: this.decisionReason(),
    });
    this.closeDecisionReasonDialog();
  }

  protected errorMessage(input: { readonly error: ChallengeFailure | null }): string | null {
    return input.error === null ? null : challengeErrorMessage({ error: input.error });
  }

  protected challengeTitle(input: { readonly challenge: Challenge | null }): string {
    return input.challenge === null ? 'Challenge proposals' : input.challenge.title;
  }

  protected decisionAuditsForSubmission(input: {
    readonly submissionId: SubmissionId;
  }): readonly SubmissionDecisionAudit[] {
    return this.store.decisionAuditsForSubmission({ submissionId: input.submissionId });
  }

  protected isLoadingDecisionAudits(input: { readonly submissionId: SubmissionId }): boolean {
    return this.store.isLoadingSubmissionDecisionAudits({ submissionId: input.submissionId });
  }

  protected decisionActorLabel(input: { readonly audit: SubmissionDecisionAudit }): string {
    return input.audit.decidedByUserEmail ?? input.audit.decidedByUserId;
  }

  protected decisionStatusLabel(input: { readonly status: Submission['status'] }): string {
    const labels: Record<Submission['status'], string> = {
      accepted: 'Shortlisted',
      rejected: 'Rejected',
      selected: 'Selected',
      submitted: 'Submitted',
      'not-selected': 'Not selected',
    };

    return labels[input.status];
  }

  protected decisionStatusSeverity(input: {
    readonly status: Submission['status'];
  }): 'danger' | 'info' | 'secondary' | 'success' {
    if (input.status === 'selected') {
      return 'success';
    }

    if (input.status === 'accepted') {
      return 'info';
    }

    if (input.status === 'rejected') {
      return 'danger';
    }

    return 'secondary';
  }

  protected decisionDateLabel(input: { readonly decidedAt: Date }): string {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(input.decidedAt);
  }

  protected pendingReasonDecisionTitle(input: {
    readonly pendingDecision: PendingReasonDecision | null;
  }): string {
    if (input.pendingDecision?.decision === 'select') {
      return 'Final selection note';
    }

    return 'Rejection note';
  }

  protected pendingReasonDecisionActionLabel(input: {
    readonly pendingDecision: PendingReasonDecision | null;
  }): string {
    if (input.pendingDecision?.decision === 'select') {
      return 'Select final startup';
    }

    return 'Reject proposal';
  }

  private readChallengeId(): ChallengeId | null {
    return this.route.snapshot.paramMap.get('challengeId') as ChallengeId | null;
  }

  private findChallenge(): Challenge | null {
    const challengeId = this.challengeId();

    if (challengeId === null) {
      return null;
    }

    return this.store.challenges().find((challenge) => challenge.id === challengeId) ?? null;
  }

  private submissionSortRank(input: { readonly submission: Submission }): number {
    const ranks: Record<Submission['status'], number> = {
      accepted: 1,
      submitted: 2,
      'not-selected': 3,
      rejected: 4,
      selected: 0,
    };

    return ranks[input.submission.status];
  }

  private async decideSubmission(input: {
    readonly submissionId: SubmissionId;
    readonly decision: 'accept' | 'reject' | 'select';
    readonly successSummary: string;
    readonly reason?: string | null | undefined;
  }): Promise<void> {
    const challengeId = this.challengeId();

    if (challengeId === null || this.finalSelectionLocked()) {
      return;
    }

    const result = await this.runSubmissionDecision({
      challengeId,
      decision: input.decision,
      reason: input.reason,
      submissionId: input.submissionId,
    });

    if (!result.ok) {
      return;
    }

    this.messageService.add({
      severity: 'success',
      summary: input.successSummary,
      detail: `${result.value.startupOrganizationId} has been updated.`,
    });
  }

  private runSubmissionDecision(input: {
    readonly challengeId: ChallengeId;
    readonly submissionId: SubmissionId;
    readonly decision: 'accept' | 'reject' | 'select';
    readonly reason?: string | null | undefined;
  }) {
    if (input.decision === 'accept') {
      return this.store.acceptSubmission({
        challengeId: input.challengeId,
        submissionId: input.submissionId,
        reason: input.reason,
      });
    }

    if (input.decision === 'reject') {
      return this.store.rejectSubmission({
        challengeId: input.challengeId,
        submissionId: input.submissionId,
        reason: input.reason,
      });
    }

    return this.store.selectSubmission({
      challengeId: input.challengeId,
      submissionId: input.submissionId,
      reason: input.reason,
    });
  }

  private openDecisionReasonDialog(input: PendingReasonDecision): void {
    if (this.finalSelectionLocked()) {
      return;
    }

    this.pendingReasonDecision.set(input);
    this.decisionReason.set('');
  }
}

type PendingReasonDecision = {
  readonly submissionId: SubmissionId;
  readonly decision: 'reject' | 'select';
  readonly successSummary: string;
};

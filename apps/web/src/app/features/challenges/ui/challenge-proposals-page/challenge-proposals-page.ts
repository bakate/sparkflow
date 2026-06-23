import { Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Tag } from 'primeng/tag';
import type { ChallengeId, SubmissionId } from '@shared/domain/result';
import { CHALLENGE_GATEWAY, type ChallengeFailure } from '../../application/challenge-gateway';
import { ChallengesStore } from '../../application/challenges-store';
import type { Challenge } from '../../domain/challenge';
import { HttpChallengeGateway } from '../../infrastructure/http-challenge-gateway';
import { challengeErrorMessage } from '../challenge-error-message';
import { ChallengeStatusLabel } from '../challenge-status-label';
import { ChallengeSubmissionsReview } from '../challenge-submissions-review/challenge-submissions-review';

@Component({
  selector: 'app-challenge-proposals-page',
  imports: [ChallengeStatusLabel, ChallengeSubmissionsReview, RouterLink, Tag],
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
  protected readonly challenge = computed(() => this.findChallenge());
  protected readonly submissions = computed(() => {
    const challengeId = this.challengeId();

    return challengeId === null ? [] : this.store.submissionsForChallenge({ challengeId });
  });
  protected readonly pendingProposalCount = computed(
    () => this.submissions().filter((submission) => submission.status === 'submitted').length,
  );
  protected readonly acceptedProposalCount = computed(
    () => this.submissions().filter((submission) => submission.status === 'accepted').length,
  );
  protected readonly rejectedProposalCount = computed(
    () => this.submissions().filter((submission) => submission.status === 'rejected').length,
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
  }

  protected async acceptSubmission(input: { readonly submissionId: SubmissionId }): Promise<void> {
    await this.decideSubmission({
      submissionId: input.submissionId,
      decision: 'accept',
      successSummary: 'Proposal shortlisted',
    });
  }

  protected async rejectSubmission(input: { readonly submissionId: SubmissionId }): Promise<void> {
    await this.decideSubmission({
      submissionId: input.submissionId,
      decision: 'reject',
      successSummary: 'Proposal rejected',
    });
  }

  protected errorMessage(input: { readonly error: ChallengeFailure | null }): string | null {
    return input.error === null ? null : challengeErrorMessage({ error: input.error });
  }

  protected challengeTitle(input: { readonly challenge: Challenge | null }): string {
    return input.challenge === null ? 'Challenge proposals' : input.challenge.title;
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

  private async decideSubmission(input: {
    readonly submissionId: SubmissionId;
    readonly decision: 'accept' | 'reject';
    readonly successSummary: string;
  }): Promise<void> {
    const challengeId = this.challengeId();

    if (challengeId === null) {
      return;
    }

    const result =
      input.decision === 'accept'
        ? await this.store.acceptSubmission({ challengeId, submissionId: input.submissionId })
        : await this.store.rejectSubmission({ challengeId, submissionId: input.submissionId });

    if (!result.ok) {
      return;
    }

    this.messageService.add({
      severity: 'success',
      summary: input.successSummary,
      detail: `${result.value.startupOrganizationId} has been updated.`,
    });
  }
}

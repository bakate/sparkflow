import { Component, input, output } from '@angular/core';
import type { SubmissionStatus } from '@sparkflow/contracts';
import { Button } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';
import type { SubmissionId } from '@shared/domain/result';
import type { Submission } from '../../domain/submission';

@Component({
  selector: 'challenge-submissions-review',
  imports: [Button, Skeleton, Tag],
  templateUrl: './challenge-submissions-review.html',
})
export class ChallengeSubmissionsReview {
  readonly submissions = input.required<readonly Submission[]>();
  readonly loading = input(false);
  readonly errorMessage = input<string | null>(null);
  readonly decidingSubmissionIds = input<readonly string[]>([]);
  readonly finalSelectionLocked = input(false);
  readonly accepted = output<{ readonly submissionId: SubmissionId }>();
  readonly rejected = output<{ readonly submissionId: SubmissionId }>();
  readonly selected = output<{ readonly submissionId: SubmissionId }>();

  protected canDecide(input: { readonly submission: Submission }): boolean {
    return !this.finalSelectionLocked() && input.submission.status === 'submitted';
  }

  protected canSelect(input: { readonly submission: Submission }): boolean {
    return (
      !this.finalSelectionLocked() &&
      input.submission.status === 'accepted' &&
      !this.hasSelectedSubmission()
    );
  }

  private hasSelectedSubmission(): boolean {
    return this.submissions().some((submission) => submission.status === 'selected');
  }

  protected isDeciding(input: { readonly submissionId: SubmissionId }): boolean {
    return this.decidingSubmissionIds().includes(input.submissionId);
  }

  protected formatDate(input: { readonly date: Date }): string {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(input.date);
  }

  protected proposalCardClass(input: { readonly status: SubmissionStatus }): string {
    if (input.status === 'selected') {
      return 'p-3 border-2 border-green-500 border-round surface-card shadow-1';
    }

    return 'p-3 border-1 surface-border border-round surface-card';
  }

  protected isClosedByFinalSelection(input: { readonly submission: Submission }): boolean {
    return (
      this.finalSelectionLocked() &&
      (input.submission.status === 'submitted' || input.submission.status === 'accepted')
    );
  }

  protected statusLabel(input: { readonly status: SubmissionStatus }): string {
    const labels: Record<SubmissionStatus, string> = {
      submitted: 'Pending',
      accepted: 'Shortlisted',
      rejected: 'Rejected',
      selected: 'Selected',
      'not-selected': 'Not selected',
    };

    return labels[input.status];
  }

  protected statusSeverity(input: {
    readonly status: SubmissionStatus;
  }): 'danger' | 'info' | 'secondary' | 'success' {
    if (input.status === 'accepted' || input.status === 'selected') {
      return 'success';
    }

    if (input.status === 'not-selected') {
      return 'secondary';
    }

    if (input.status === 'rejected') {
      return 'danger';
    }

    return 'info';
  }
}

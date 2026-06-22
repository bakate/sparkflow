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
  readonly accepted = output<{ readonly submissionId: SubmissionId }>();
  readonly rejected = output<{ readonly submissionId: SubmissionId }>();

  protected canDecide(input: { readonly submission: Submission }): boolean {
    return input.submission.status === 'submitted';
  }

  protected isDeciding(input: { readonly submissionId: SubmissionId }): boolean {
    return this.decidingSubmissionIds().includes(input.submissionId);
  }

  protected formatDate(input: { readonly date: Date }): string {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(input.date);
  }

  protected statusLabel(input: { readonly status: SubmissionStatus }): string {
    const labels: Record<SubmissionStatus, string> = {
      submitted: 'Submitted',
      accepted: 'Accepted',
      rejected: 'Rejected',
    };

    return labels[input.status];
  }

  protected statusSeverity(input: {
    readonly status: SubmissionStatus;
  }): 'danger' | 'info' | 'success' {
    if (input.status === 'accepted') {
      return 'success';
    }

    if (input.status === 'rejected') {
      return 'danger';
    }

    return 'info';
  }
}

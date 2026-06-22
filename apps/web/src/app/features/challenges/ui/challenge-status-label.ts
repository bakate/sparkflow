import { Component, input } from '@angular/core';
import type { ChallengeStatus } from '@sparkflow/contracts';
import { Tag } from 'primeng/tag';

export type ChallengeStatusLabelValue =
  | ChallengeStatus
  | 'accepted'
  | 'assessed'
  | 'open'
  | 'rejected'
  | 'under-review';

@Component({
  selector: 'challenge-status-label',
  imports: [Tag],
  template: ` <p-tag [severity]="severity()" [value]="label()" /> `,
})
export class ChallengeStatusLabel {
  readonly status = input.required<ChallengeStatusLabelValue>();

  protected label(): string {
    const status = this.status();

    if (status === 'assessed') {
      return 'Assessed';
    }

    if (status === 'archived') {
      return 'Archived';
    }

    if (status === 'accepted') {
      return 'Accepted';
    }

    if (status === 'open') {
      return 'Open';
    }

    if (status === 'rejected') {
      return 'Rejected';
    }

    if (status === 'under-review') {
      return 'Under review';
    }

    return status === 'published' ? 'Published' : 'Draft';
  }

  protected severity(): 'contrast' | 'danger' | 'info' | 'secondary' | 'success' {
    const status = this.status();

    if (status === 'assessed') {
      return 'info';
    }

    if (status === 'archived') {
      return 'contrast';
    }

    if (status === 'open') {
      return 'success';
    }

    if (status === 'rejected') {
      return 'danger';
    }

    if (status === 'under-review') {
      return 'info';
    }

    if (status === 'accepted') {
      return 'success';
    }

    return status === 'published' ? 'success' : 'secondary';
  }
}

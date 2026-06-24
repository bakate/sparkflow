import { Component, computed, input } from '@angular/core';
import type { ChallengeStatus } from '@sparkflow/contracts';
import { Tag } from 'primeng/tag';

export type ChallengeStatusLabelValue =
  | ChallengeStatus
  | 'accepted'
  | 'assessed'
  | 'open'
  | 'not-selected'
  | 'rejected'
  | 'selected'
  | 'under-review';

type Severity = 'contrast' | 'danger' | 'info' | 'secondary' | 'success';

const STATUS_CONFIG: Record<ChallengeStatusLabelValue, { label: string; severity: Severity }> = {
  assessed: { label: 'Assessed', severity: 'info' },
  archived: { label: 'Archived', severity: 'contrast' },
  accepted: { label: 'Shortlisted', severity: 'success' },
  open: { label: 'Open', severity: 'success' },
  'not-selected': { label: 'Not selected', severity: 'secondary' },
  rejected: { label: 'Rejected', severity: 'danger' },
  selected: { label: 'Selected', severity: 'success' },
  'under-review': { label: 'Under review', severity: 'info' },
  published: { label: 'Published', severity: 'success' },
  draft: { label: 'Draft', severity: 'secondary' },
};

@Component({
  selector: 'challenge-status-label',
  imports: [Tag],
  template: ` <p-tag [severity]="config().severity" [value]="config().label" /> `,
})
export class ChallengeStatusLabel {
  readonly status = input.required<ChallengeStatusLabelValue>();
  protected readonly config = computed(() => STATUS_CONFIG[this.status()]);
}

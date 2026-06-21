import { Component, input } from '@angular/core';
import type { ChallengeStatus } from '@sparkflow/contracts';
import { Tag } from 'primeng/tag';

@Component({
  selector: 'challenge-status-label',
  imports: [Tag],
  template: ` <p-tag [severity]="severity()" [value]="label()" /> `,
})
export class ChallengeStatusLabel {
  readonly status = input.required<ChallengeStatus>();

  protected label(): string {
    return this.status() === 'published' ? 'Published' : 'Draft';
  }

  protected severity(): 'success' | 'secondary' {
    return this.status() === 'published' ? 'success' : 'secondary';
  }
}

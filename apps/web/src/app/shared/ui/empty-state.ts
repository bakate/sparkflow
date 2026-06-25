import { Component, input, output } from '@angular/core';
import { Button } from 'primeng/button';

@Component({
  selector: 'empty-state',
  imports: [Button],
  template: `
    <div
      class="flex flex-column align-items-start gap-3 p-3 border-1 surface-border border-round surface-card"
      [class.py-4]="!compact()"
      [class.align-items-center]="centered()"
      [class.text-center]="centered()"
    >
      <div
        class="inline-flex align-items-center justify-content-center border-circle bg-primary-50 text-primary"
        style="width: 2.5rem; height: 2.5rem"
        aria-hidden="true"
      >
        <i [class]="icon()"></i>
      </div>

      <div class="flex flex-column gap-1">
        <p class="m-0 font-bold text-color">{{ title() }}</p>
        <p class="m-0 text-color-secondary line-height-3">{{ description() }}</p>
      </div>

      @if (actionLabel(); as actionLabel) {
        <p-button
          [icon]="actionIcon()"
          [label]="actionLabel"
          severity="secondary"
          [outlined]="true"
          (onClick)="action.emit()"
        />
      }
    </div>
  `,
})
export class EmptyState {
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly icon = input('pi pi-inbox');
  readonly actionIcon = input('pi pi-refresh');
  readonly actionLabel = input<string | null>(null);
  readonly compact = input(false);
  readonly centered = input(false);
  readonly action = output<void>();
}

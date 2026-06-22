import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Tab, TabList, Tabs } from 'primeng/tabs';

@Component({
  selector: 'challenge-tabs',
  imports: [RouterLink, Tab, TabList, Tabs],
  templateUrl: './challenge-tabs.html',
})
export class ChallengeTabs {
  readonly activeTab = input.required<string>();
  readonly tabs = input.required<readonly ChallengeTabItem[]>();
  readonly selected = output<{ readonly tab: string }>();

  protected selectTab(input: { readonly value: string | number | undefined }): void {
    if (typeof input.value !== 'string') {
      return;
    }

    this.selected.emit({ tab: input.value });
  }
}

export type ChallengeTabItem = {
  readonly icon: string;
  readonly label: string;
  readonly value: string;
};

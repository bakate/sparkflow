import { Component, computed, input, output } from '@angular/core';
import type { SubmissionStatus } from '@sparkflow/contracts';
import type { MenuItem, MenuItemCommandEvent } from 'primeng/api';
import { Badge } from 'primeng/badge';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { SplitButton } from 'primeng/splitbutton';
import type { ChallengeId } from '@shared/domain/result';
import {
  canArchiveChallenge,
  canDraftChallenge,
  canEditChallenge,
  canPublishChallenge,
  canReviewChallengeSubmissions,
  canSubmitChallengeProposal,
  type Challenge,
  type ChallengeActor,
} from '../../domain/challenge';
import { ChallengeStatusLabel, type ChallengeStatusLabelValue } from '../challenge-status-label';

@Component({
  selector: 'challenge-card',
  imports: [Badge, Button, Card, ChallengeStatusLabel, SplitButton],
  templateUrl: './challenge-card.html',
})
export class ChallengeCard {
  readonly challenge = input.required<Challenge>();
  readonly currentActor = input<ChallengeActor | null>(null);
  readonly assessed = input(false);
  readonly proposalCount = input(0);
  readonly archiving = input(false);
  readonly drafting = input(false);
  readonly pendingProposalCount = input(0);
  readonly publishing = input(false);
  readonly loadingSubmissions = input(false);
  readonly submittingProposal = input(false);
  readonly proposalSubmitted = input(false);
  readonly proposalStatus = input<SubmissionStatus | null>(null);
  readonly edit = output<{ readonly challengeId: ChallengeId }>();
  readonly archive = output<{ readonly challengeId: ChallengeId }>();
  readonly draft = output<{ readonly challengeId: ChallengeId }>();
  readonly publish = output<{ readonly challengeId: ChallengeId }>();
  readonly reviewSubmissions = output<{ readonly challengeId: ChallengeId }>();
  readonly submitProposal = output<{ readonly challengeId: ChallengeId }>();
  protected readonly companyActionMenuItems = computed<MenuItem[]>(() => {
    const primaryAction = this.primaryCompanyAction();

    return this.companyActions()
      .filter((action) => action !== primaryAction)
      .map((action) => ({
        icon: this.actionIcon({ action }),
        label: this.actionLabel({ action }),
        command: (event) => {
          this.runMenuCompanyAction({ action, event });
        },
      }));
  });

  protected canEdit(): boolean {
    const actor = this.currentActor();

    if (actor === null) {
      return false;
    }

    return canEditChallenge({
      actor,
      challenge: this.challenge(),
    });
  }

  protected statusLabelValue(): ChallengeStatusLabelValue {
    const proposalStatus = this.proposalStatus();

    if (this.challenge().status === 'archived') {
      return 'archived';
    }

    if (proposalStatus === 'accepted' || proposalStatus === 'rejected') {
      return proposalStatus;
    }

    if (proposalStatus === 'submitted') {
      return 'under-review';
    }

    if (this.currentActor()?.role === 'startup-member' && this.challenge().status === 'published') {
      return 'open';
    }

    return this.assessed() ? 'assessed' : this.challenge().status;
  }

  protected canPublish(): boolean {
    return this.canEdit() && canPublishChallenge({ challenge: this.challenge() });
  }

  protected canDraft(): boolean {
    return this.canEdit() && canDraftChallenge({ challenge: this.challenge() });
  }

  protected canArchive(): boolean {
    const actor = this.currentActor();

    if (actor === null) {
      return false;
    }

    return canArchiveChallenge({
      actor,
      challenge: this.challenge(),
    });
  }

  protected canReviewSubmissions(): boolean {
    const actor = this.currentActor();

    if (actor === null) {
      return false;
    }

    return canReviewChallengeSubmissions({
      actor,
      challenge: this.challenge(),
    });
  }

  protected canSubmitProposal(): boolean {
    if (this.proposalSubmitted()) {
      return false;
    }

    const actor = this.currentActor();

    if (actor === null) {
      return false;
    }

    return canSubmitChallengeProposal({
      actor,
      challenge: this.challenge(),
    });
  }

  protected hasCompanyActions(): boolean {
    return this.companyActions().length > 0;
  }

  protected primaryCompanyActionLabel(): string {
    return this.actionLabel({ action: this.primaryCompanyAction() });
  }

  protected primaryCompanyActionIcon(): string {
    return this.actionIcon({ action: this.primaryCompanyAction() });
  }

  protected runPrimaryCompanyAction(): void {
    this.emitAction({ action: this.primaryCompanyAction() });
  }

  protected runMenuCompanyAction(input: {
    readonly action: ChallengeCardAction;
    readonly event: MenuItemCommandEvent;
  }): void {
    input.event.originalEvent?.preventDefault();
    input.event.originalEvent?.stopPropagation();
    this.emitAction({ action: input.action });
  }

  protected isCompanyActionPending(): boolean {
    return this.archiving() || this.drafting() || this.loadingSubmissions() || this.publishing();
  }

  protected formatDate(input: { readonly date: Date }): string {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(input.date);
  }

  protected proposalStatusLabel(): string {
    const status = this.proposalStatus();

    if (status === 'accepted') {
      return 'Proposal accepted';
    }

    if (status === 'rejected') {
      return 'Proposal rejected';
    }

    return 'Proposal submitted';
  }

  protected proposalCountLabel(): string {
    return this.proposalCount() === 1 ? '1 proposal' : `${this.proposalCount()} proposals`;
  }

  private companyActions(): ChallengeCardAction[] {
    const actions: ChallengeCardAction[] = [];

    if (this.canReviewSubmissions()) {
      actions.push('proposals');
    }

    if (this.canPublish()) {
      actions.push('publish');
    }

    if (this.canDraft()) {
      actions.push('draft');
    }

    if (this.canArchive()) {
      actions.push('archive');
    }

    if (this.canEdit()) {
      actions.push('edit');
    }

    return actions;
  }

  private primaryCompanyAction(): ChallengeCardAction {
    const action = this.companyActions()[0];

    if (action === undefined) {
      return 'edit';
    }

    return action;
  }

  private actionIcon(input: { readonly action: ChallengeCardAction }): string {
    const icons: Record<ChallengeCardAction, string> = {
      archive: 'pi pi-box',
      draft: 'pi pi-file',
      edit: 'pi pi-pencil',
      proposals: 'pi pi-inbox',
      publish: 'pi pi-send',
    };

    return icons[input.action];
  }

  private actionLabel(input: { readonly action: ChallengeCardAction }): string {
    const labels: Record<ChallengeCardAction, string> = {
      archive: 'Archive',
      draft: 'Move to draft',
      edit: 'Edit',
      proposals: 'Review',
      publish: 'Publish',
    };

    return labels[input.action];
  }

  private emitAction(input: { readonly action: ChallengeCardAction }): void {
    const challengeId = this.challenge().id;

    if (input.action === 'archive') {
      this.archive.emit({ challengeId });
      return;
    }

    if (input.action === 'edit') {
      this.edit.emit({ challengeId });
      return;
    }

    if (input.action === 'draft') {
      this.draft.emit({ challengeId });
      return;
    }

    if (input.action === 'proposals') {
      this.reviewSubmissions.emit({ challengeId });
      return;
    }

    this.publish.emit({ challengeId });
  }
}

type ChallengeCardAction = 'archive' | 'draft' | 'edit' | 'proposals' | 'publish';

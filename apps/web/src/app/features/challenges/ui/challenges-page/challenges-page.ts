import { Component, computed, inject, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import type { ChallengeId } from '@shared/domain/result';
import { AuthSession } from '@shared/auth/auth-session';
import { CHALLENGE_GATEWAY, type ChallengeFailure } from '../../application/challenge-gateway';
import { ChallengesStore } from '../../application/challenges-store';
import { canCreateChallenge, type Challenge } from '../../domain/challenge';
import { HttpChallengeGateway } from '../../infrastructure/http-challenge-gateway';
import { ChallengeCard } from '../challenge-card/challenge-card';
import {
  ChallengeForm,
  type ChallengeFormSubmitted,
  type ChallengeFormValue,
} from '../challenge-form/challenge-form';
import {
  ChallengeSubmissionForm,
  type ChallengeSubmissionFormSubmitted,
} from '../challenge-submission-form/challenge-submission-form';

type ChallengeTab = 'archived' | 'in-progress' | 'published';

@Component({
  selector: 'app-challenges-page',
  imports: [Button, ChallengeCard, ChallengeForm, ChallengeSubmissionForm, Dialog],
  providers: [
    ChallengesStore,
    {
      provide: CHALLENGE_GATEWAY,
      useClass: HttpChallengeGateway,
    },
  ],
  templateUrl: './challenges-page.html',
})
export class ChallengesPage {
  protected readonly store = inject(ChallengesStore);
  private readonly messageService = inject(MessageService);
  protected readonly currentActor = inject(AuthSession).currentActor;
  protected readonly challengeFormDialogVisible = signal(false);
  protected readonly selectedChallengeId = signal<ChallengeId | null>(null);
  protected readonly challengeFormDialogError = signal<ChallengeFailure | null>(null);
  protected readonly challengeFormResetKey = signal(0);
  protected readonly proposalDialogVisible = signal(false);
  protected readonly selectedProposalChallengeId = signal<ChallengeId | null>(null);
  protected readonly proposalDialogError = signal<ChallengeFailure | null>(null);
  protected readonly proposalFormResetKey = signal(0);
  protected readonly activeChallengeTab = signal<ChallengeTab>('published');
  protected readonly challengeFormDialogTitle = computed(() =>
    this.selectedChallengeId() === null ? 'Create challenge' : 'Edit challenge',
  );
  protected readonly canCreateChallenge = computed(() => {
    const actor = this.currentActor();

    return actor === null ? false : canCreateChallenge({ actor });
  });
  protected readonly selectedChallenge = computed(() =>
    this.findChallenge({ challengeId: this.selectedChallengeId() }),
  );
  protected readonly usesStartupChallengeTabs = computed(
    () => this.currentActor()?.role === 'startup-member',
  );
  protected readonly displayedChallenges = computed(() => {
    if (!this.usesStartupChallengeTabs()) {
      return this.store.challenges();
    }

    const challenges = this.store.challenges();
    const selectedTab = this.activeChallengeTab();

    if (selectedTab === 'published') {
      return challenges.filter(
        (challenge) =>
          challenge.status === 'published' &&
          this.store.submissionForChallenge({ challengeId: challenge.id }) === null,
      );
    }

    if (selectedTab === 'in-progress') {
      return challenges.filter(
        (challenge) =>
          this.store.submissionForChallenge({ challengeId: challenge.id })?.status === 'submitted',
      );
    }

    return challenges.filter((challenge) => {
      const submission = this.store.submissionForChallenge({ challengeId: challenge.id });

      return submission?.status === 'accepted' || submission?.status === 'rejected';
    });
  });
  protected readonly publishedStartupChallengeCount = computed(
    () =>
      this.store
        .challenges()
        .filter(
          (challenge) =>
            challenge.status === 'published' &&
            this.store.submissionForChallenge({ challengeId: challenge.id }) === null,
        ).length,
  );
  protected readonly inProgressStartupChallengeCount = computed(
    () =>
      this.store
        .challenges()
        .filter(
          (challenge) =>
            this.store.submissionForChallenge({ challengeId: challenge.id })?.status ===
            'submitted',
        ).length,
  );
  protected readonly archivedStartupChallengeCount = computed(
    () =>
      this.store.challenges().filter((challenge) => {
        const submission = this.store.submissionForChallenge({ challengeId: challenge.id });

        return submission?.status === 'accepted' || submission?.status === 'rejected';
      }).length,
  );
  protected readonly challengeFormValue = computed<ChallengeFormValue>(() => {
    const challenge = this.selectedChallenge();

    return challenge === null
      ? { title: '', description: '' }
      : {
          title: challenge.title,
          description: challenge.description,
        };
  });

  protected reloadChallenges(): void {
    this.store.reloadChallenges();
  }

  protected selectChallengeTab(input: { readonly tab: ChallengeTab }): void {
    this.activeChallengeTab.set(input.tab);
  }

  protected openChallengeFormDialog(input: { readonly challengeId: ChallengeId | null }): void {
    this.selectedChallengeId.set(input.challengeId);
    this.challengeFormDialogError.set(null);
    this.resetChallengeForm();
    this.challengeFormDialogVisible.set(true);
  }

  protected closeChallengeFormDialog(): void {
    this.challengeFormDialogError.set(null);
    this.resetChallengeForm();
    this.selectedChallengeId.set(null);
    this.challengeFormDialogVisible.set(false);
  }

  protected setChallengeFormDialogVisible(input: { readonly visible: boolean }): void {
    if (input.visible) {
      this.openChallengeFormDialog({ challengeId: this.selectedChallengeId() });
      return;
    }

    this.closeChallengeFormDialog();
  }

  protected async submitChallengeForm(command: ChallengeFormSubmitted): Promise<void> {
    this.challengeFormDialogError.set(null);
    const challengeId = command.challengeId;

    if (challengeId !== null) {
      const result = await this.store.updateChallenge({
        challengeId,
        title: command.title,
        description: command.description,
      });

      if (!result.ok) {
        this.challengeFormDialogError.set(result.error);
        return;
      }

      this.closeSuccessfulChallengeFormDialog();
      this.messageService.add({
        severity: 'success',
        summary: 'Challenge updated',
        detail: `${result.value.title} has been updated.`,
      });
      return;
    }

    const result = await this.store.createChallenge({
      title: command.title,
      description: command.description,
    });

    if (!result.ok) {
      this.challengeFormDialogError.set(result.error);
      return;
    }

    this.closeSuccessfulChallengeFormDialog();
    this.messageService.add({
      severity: 'success',
      summary: 'Challenge created',
      detail: `${result.value.title} has been created.`,
    });
  }

  protected openProposalDialog(input: { readonly challengeId: ChallengeId }): void {
    this.selectedProposalChallengeId.set(input.challengeId);
    this.proposalDialogError.set(null);
    this.resetProposalForm();
    this.proposalDialogVisible.set(true);
  }

  protected closeProposalDialog(): void {
    this.proposalDialogError.set(null);
    this.resetProposalForm();
    this.selectedProposalChallengeId.set(null);
    this.proposalDialogVisible.set(false);
  }

  protected setProposalDialogVisible(input: { readonly visible: boolean }): void {
    if (input.visible) {
      const challengeId = this.selectedProposalChallengeId();

      if (challengeId !== null) {
        this.openProposalDialog({ challengeId });
      }
      return;
    }

    this.closeProposalDialog();
  }

  protected async submitChallengeProposal(
    command: ChallengeSubmissionFormSubmitted,
  ): Promise<void> {
    this.proposalDialogError.set(null);
    const result = await this.store.submitChallengeProposal(command);

    if (!result.ok) {
      this.proposalDialogError.set(result.error);
      return;
    }

    this.closeSuccessfulProposalDialog();
    this.messageService.add({
      severity: 'success',
      summary: 'Proposal submitted',
      detail: 'Your proposal has been submitted.',
    });
  }

  protected publishChallenge(input: { readonly challengeId: ChallengeId }): void {
    void this.store.publishChallenge(input);
  }

  protected errorMessage(error: ChallengeFailure | null): string {
    return error === null ? '' : errorMessages[error];
  }

  protected challengeFormDialogErrorMessage(): string | null {
    const error = this.challengeFormDialogError();

    return error === null ? null : errorMessages[error];
  }

  protected proposalDialogErrorMessage(): string | null {
    const error = this.proposalDialogError();

    return error === null ? null : errorMessages[error];
  }

  private resetChallengeForm(): void {
    this.challengeFormResetKey.update((resetKey) => resetKey + 1);
  }

  private resetProposalForm(): void {
    this.proposalFormResetKey.update((resetKey) => resetKey + 1);
  }

  private closeSuccessfulChallengeFormDialog(): void {
    this.resetChallengeForm();
    this.selectedChallengeId.set(null);
    this.challengeFormDialogVisible.set(false);
  }

  private closeSuccessfulProposalDialog(): void {
    this.resetProposalForm();
    this.selectedProposalChallengeId.set(null);
    this.proposalDialogVisible.set(false);
  }

  private findChallenge(input: { readonly challengeId: ChallengeId | null }): Challenge | null {
    if (input.challengeId === null) {
      return null;
    }

    return this.store.challenges().find((challenge) => challenge.id === input.challengeId) ?? null;
  }
}

const errorMessages: Record<ChallengeFailure, string> = {
  'challenge-title-required': 'Title is required.',
  'challenge-description-required': 'Description is required.',
  'challenge-already-published': 'Challenge is already published.',
  'challenge-not-found': 'Challenge was not found.',
  'submission-summary-required': 'Summary is required.',
  forbidden: 'You are not allowed to perform this action.',
  'network-error': 'API gateway is unreachable.',
  'unexpected-error': 'Unexpected challenge error.',
};

import { Component, computed, inject, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import type { ChallengeId } from '@shared/domain/result';
import { CHALLENGE_GATEWAY, type ChallengeFailure } from '../../application/challenge-gateway';
import { ChallengesStore } from '../../application/challenges-store';
import { HttpChallengeGateway } from '../../infrastructure/http-challenge-gateway';
import { ChallengeCard } from '../challenge-card/challenge-card';
import { ChallengeForm, type ChallengeFormSubmitted } from '../challenge-form/challenge-form';

@Component({
  selector: 'app-challenges-page',
  imports: [Button, ChallengeCard, ChallengeForm, Dialog],
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
  protected readonly challengeFormDialogVisible = signal(false);
  protected readonly selectedChallengeId = signal<ChallengeId | null>(null);
  protected readonly challengeFormDialogError = signal<ChallengeFailure | null>(null);
  protected readonly challengeFormResetKey = signal(0);
  protected readonly challengeFormDialogTitle = computed(() =>
    this.selectedChallengeId() === null ? 'Create challenge' : 'Edit challenge',
  );

  protected reloadChallenges(): void {
    this.store.reloadChallenges();
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
      this.challengeFormDialogError.set('unexpected-error');
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

    this.resetChallengeForm();
    this.challengeFormDialogVisible.set(false);
    this.messageService.add({
      severity: 'success',
      summary: 'Challenge created',
      detail: `${result.value.title} has been created.`,
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

  private resetChallengeForm(): void {
    this.challengeFormResetKey.update((resetKey) => resetKey + 1);
  }
}

const errorMessages: Record<ChallengeFailure, string> = {
  'challenge-title-required': 'Title is required.',
  'challenge-description-required': 'Description is required.',
  'challenge-already-published': 'Challenge is already published.',
  'challenge-not-found': 'Challenge was not found.',
  forbidden: 'You are not allowed to perform this action.',
  'network-error': 'API gateway is unreachable.',
  'unexpected-error': 'Unexpected challenge error.',
};

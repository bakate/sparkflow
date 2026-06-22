import { Component, input, output } from '@angular/core';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import type { ChallengeId } from '@shared/domain/result';
import {
  canEditChallenge,
  canPublishChallenge,
  type Challenge,
  type ChallengeActor,
} from '../../domain/challenge';
import { ChallengeStatusLabel } from '../challenge-status-label';

@Component({
  selector: 'challenge-card',
  imports: [Button, Card, ChallengeStatusLabel],
  templateUrl: './challenge-card.html',
})
export class ChallengeCard {
  readonly challenge = input.required<Challenge>();
  readonly currentActor = input<ChallengeActor | null>(null);
  readonly publishing = input(false);
  readonly edit = output<{ readonly challengeId: ChallengeId }>();
  readonly publish = output<{ readonly challengeId: ChallengeId }>();

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

  protected canPublish(): boolean {
    return this.canEdit() && canPublishChallenge({ challenge: this.challenge() });
  }

  protected formatDate(input: { readonly date: Date }): string {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(input.date);
  }
}

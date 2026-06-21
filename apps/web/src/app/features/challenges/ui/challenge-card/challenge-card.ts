import { Component, input, output } from '@angular/core';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import type { ChallengeId } from '@shared/domain/result';
import { canPublishChallenge, type Challenge } from '../../domain/challenge';
import { ChallengeStatusLabel } from '../challenge-status-label';

@Component({
  selector: 'challenge-card',
  imports: [Button, Card, ChallengeStatusLabel],
  templateUrl: './challenge-card.html',
})
export class ChallengeCard {
  readonly challenge = input.required<Challenge>();
  readonly publishing = input(false);
  readonly publish = output<{ readonly challengeId: ChallengeId }>();

  protected canPublish(): boolean {
    return canPublishChallenge({ challenge: this.challenge() });
  }

  protected formatDate(input: { readonly date: Date }): string {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(input.date);
  }
}

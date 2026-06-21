import { computed, inject, Injectable, resource, signal } from '@angular/core';
import { fail, type Result, succeed } from '../../../shared/domain/result';
import {
  CHALLENGE_GATEWAY,
  type ChallengeFailure,
  type CreateChallengeCommand,
  type PublishChallengeCommand,
} from './challenge-gateway';
import { canPublishChallenge, type Challenge } from '../domain/challenge';

@Injectable()
export class ChallengesStore {
  private readonly challengeGateway = inject(CHALLENGE_GATEWAY);
  private readonly challengesResource = resource({
    defaultValue: succeed<readonly Challenge[]>([]),
    loader: () => this.challengeGateway.listChallenges(),
  });
  private readonly savingState = signal(false);
  private readonly publishingIdsState = signal<readonly string[]>([]);
  private readonly commandErrorState = signal<ChallengeFailure | null>(null);

  readonly challenges = computed(() => {
    const result = this.challengesResource.value();

    return result.ok ? result.value : [];
  });
  readonly loading = this.challengesResource.isLoading;
  readonly saving = this.savingState.asReadonly();
  readonly publishingIds = this.publishingIdsState.asReadonly();
  readonly error = computed(() => {
    const commandError = this.commandErrorState();

    if (commandError !== null) {
      return commandError;
    }

    const result = this.challengesResource.value();

    return result.ok ? null : result.error;
  });
  readonly draftCount = computed(
    () => this.challenges().filter((challenge) => canPublishChallenge({ challenge })).length,
  );
  readonly publishedCount = computed(
    () => this.challenges().filter((challenge) => challenge.status === 'published').length,
  );

  reloadChallenges(): boolean {
    this.commandErrorState.set(null);
    return this.challengesResource.reload();
  }

  async createChallenge(
    command: CreateChallengeCommand,
  ): Promise<Result<ChallengeFailure, Challenge>> {
    this.savingState.set(true);
    this.commandErrorState.set(null);

    const result = await this.challengeGateway.createChallenge(command);
    this.savingState.set(false);

    if (!result.ok) {
      this.commandErrorState.set(result.error);
      return fail(result.error);
    }

    this.challengesResource.update((currentResult) =>
      currentResult.ok ? succeed([result.value, ...currentResult.value]) : succeed([result.value]),
    );
    return succeed(result.value);
  }

  async publishChallenge(
    command: PublishChallengeCommand,
  ): Promise<Result<ChallengeFailure, Challenge>> {
    this.publishingIdsState.update((challengeIds) => [...challengeIds, command.challengeId]);
    this.commandErrorState.set(null);

    const result = await this.challengeGateway.publishChallenge(command);
    this.removePublishingId({ challengeId: command.challengeId });

    if (!result.ok) {
      this.commandErrorState.set(result.error);
      return fail(result.error);
    }

    this.replaceChallenge({ challenge: result.value });
    return succeed(result.value);
  }

  isPublishing(input: { readonly challengeId: string }): boolean {
    return this.publishingIds().includes(input.challengeId);
  }

  private replaceChallenge(input: { readonly challenge: Challenge }): void {
    this.challengesResource.update((currentResult) =>
      currentResult.ok
        ? succeed(
            currentResult.value.map((challenge) =>
              challenge.id === input.challenge.id ? input.challenge : challenge,
            ),
          )
        : succeed([input.challenge]),
    );
  }

  private removePublishingId(input: { readonly challengeId: string }): void {
    this.publishingIdsState.update((challengeIds) =>
      challengeIds.filter((challengeId) => challengeId !== input.challengeId),
    );
  }
}

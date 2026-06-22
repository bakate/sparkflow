import { computed, inject, Injectable, resource, signal } from '@angular/core';
import { AuthSession } from '@shared/auth/auth-session';
import { fail, type Result, succeed } from '../../../shared/domain/result';
import {
  CHALLENGE_GATEWAY,
  type ChallengeFailure,
  type CreateChallengeCommand,
  type PublishChallengeCommand,
  type SubmitChallengeProposalCommand,
  type UpdateChallengeCommand,
} from './challenge-gateway';
import { canPublishChallenge, type Challenge } from '../domain/challenge';
import type { Submission } from '../domain/submission';

@Injectable()
export class ChallengesStore {
  private readonly authSession = inject(AuthSession);
  private readonly challengeGateway = inject(CHALLENGE_GATEWAY);
  private readonly challengesResource = resource({
    defaultValue: succeed<readonly Challenge[]>([]),
    loader: () => this.challengeGateway.listChallenges(),
  });
  private readonly mySubmissionsResource = resource({
    defaultValue: succeed<readonly Submission[]>([]),
    loader: () => {
      const actor = this.authSession.currentActor();

      return actor?.role === 'startup-member'
        ? this.challengeGateway.listMySubmissions()
        : Promise.resolve(succeed<readonly Submission[]>([]));
    },
  });
  private readonly savingState = signal(false);
  private readonly publishingIdsState = signal<readonly string[]>([]);
  private readonly submittingProposalIdsState = signal<readonly string[]>([]);
  private readonly commandErrorState = signal<ChallengeFailure | null>(null);

  readonly challenges = computed(() => {
    const result = this.challengesResource.value();

    return result.ok ? result.value : [];
  });
  readonly mySubmissions = computed(() => {
    const result = this.mySubmissionsResource.value();

    return result.ok ? result.value : [];
  });
  readonly loading = this.challengesResource.isLoading;
  readonly loadingMySubmissions = this.mySubmissionsResource.isLoading;
  readonly saving = this.savingState.asReadonly();
  readonly publishingIds = this.publishingIdsState.asReadonly();
  readonly submittingProposalIds = this.submittingProposalIdsState.asReadonly();
  readonly error = computed(() => {
    const commandError = this.commandErrorState();

    if (commandError !== null) {
      return commandError;
    }

    const result = this.challengesResource.value();

    if (!result.ok) {
      return result.error;
    }

    const mySubmissionsResult = this.mySubmissionsResource.value();

    return mySubmissionsResult.ok ? null : mySubmissionsResult.error;
  });
  readonly draftCount = computed(
    () => this.challenges().filter((challenge) => canPublishChallenge({ challenge })).length,
  );
  readonly publishedCount = computed(
    () => this.challenges().filter((challenge) => challenge.status === 'published').length,
  );

  reloadChallenges(): boolean {
    this.commandErrorState.set(null);
    const reloadedChallenges = this.challengesResource.reload();
    const reloadedSubmissions = this.mySubmissionsResource.reload();

    return reloadedChallenges || reloadedSubmissions;
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

  async updateChallenge(
    command: UpdateChallengeCommand,
  ): Promise<Result<ChallengeFailure, Challenge>> {
    this.savingState.set(true);
    this.commandErrorState.set(null);

    const result = await this.challengeGateway.updateChallenge(command);
    this.savingState.set(false);

    if (!result.ok) {
      this.commandErrorState.set(result.error);
      return fail(result.error);
    }

    this.replaceChallenge({ challenge: result.value });
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

  async submitChallengeProposal(
    command: SubmitChallengeProposalCommand,
  ): Promise<Result<ChallengeFailure, Submission>> {
    this.submittingProposalIdsState.update((challengeIds) => [
      ...challengeIds,
      command.challengeId,
    ]);
    this.commandErrorState.set(null);

    const result = await this.challengeGateway.submitChallengeProposal(command);
    this.removeSubmittingProposalId({ challengeId: command.challengeId });

    if (!result.ok) {
      this.commandErrorState.set(result.error);
      return fail(result.error);
    }

    this.mySubmissionsResource.update((currentResult) =>
      currentResult.ok ? succeed([result.value, ...currentResult.value]) : succeed([result.value]),
    );
    return succeed(result.value);
  }

  isPublishing(input: { readonly challengeId: string }): boolean {
    return this.publishingIds().includes(input.challengeId);
  }

  isSubmittingProposal(input: { readonly challengeId: string }): boolean {
    return this.submittingProposalIds().includes(input.challengeId);
  }

  hasSubmittedProposal(input: { readonly challengeId: string }): boolean {
    return this.mySubmissions().some((submission) => submission.challengeId === input.challengeId);
  }

  submissionForChallenge(input: { readonly challengeId: string }): Submission | null {
    return (
      this.mySubmissions().find((submission) => submission.challengeId === input.challengeId) ??
      null
    );
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

  private removeSubmittingProposalId(input: { readonly challengeId: string }): void {
    this.submittingProposalIdsState.update((challengeIds) =>
      challengeIds.filter((challengeId) => challengeId !== input.challengeId),
    );
  }
}

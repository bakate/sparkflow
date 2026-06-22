import { computed, inject, Injectable, resource, Service, signal } from '@angular/core';
import { AuthSession } from '@shared/auth/auth-session';
import {
  fail,
  type ChallengeId,
  type Result,
  type SubmissionId,
  succeed,
} from '../../../shared/domain/result';
import {
  CHALLENGE_GATEWAY,
  type ArchiveChallengeCommand,
  type ChallengeFailure,
  type CreateChallengeCommand,
  type DecideSubmissionCommand,
  type DraftChallengeCommand,
  type ListChallengeSubmissionsCommand,
  type PublishChallengeCommand,
  type SubmitChallengeProposalCommand,
  type UpdateChallengeCommand,
} from './challenge-gateway';
import { canPublishChallenge, type Challenge } from '../domain/challenge';
import type { Submission } from '../domain/submission';

@Service()
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
  private readonly archivingIdsState = signal<readonly string[]>([]);
  private readonly draftingIdsState = signal<readonly string[]>([]);
  private readonly publishingIdsState = signal<readonly string[]>([]);
  private readonly submittingProposalIdsState = signal<readonly string[]>([]);
  private readonly loadingSubmissionChallengeIdsState = signal<readonly string[]>([]);
  private readonly loadedSubmissionChallengeIdsState = signal<readonly string[]>([]);
  private readonly decidingSubmissionIdsState = signal<readonly string[]>([]);
  private readonly challengeSubmissionsByChallengeIdState = signal<
    Record<string, readonly Submission[]>
  >({});
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
  readonly archivingIds = this.archivingIdsState.asReadonly();
  readonly draftingIds = this.draftingIdsState.asReadonly();
  readonly publishingIds = this.publishingIdsState.asReadonly();
  readonly submittingProposalIds = this.submittingProposalIdsState.asReadonly();
  readonly loadingSubmissionChallengeIds = this.loadingSubmissionChallengeIdsState.asReadonly();
  readonly loadedSubmissionChallengeIds = this.loadedSubmissionChallengeIdsState.asReadonly();
  readonly decidingSubmissionIds = this.decidingSubmissionIdsState.asReadonly();
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

  async draftChallenge(
    command: DraftChallengeCommand,
  ): Promise<Result<ChallengeFailure, Challenge>> {
    this.draftingIdsState.update((challengeIds) => [...challengeIds, command.challengeId]);
    this.commandErrorState.set(null);

    const result = await this.challengeGateway.draftChallenge(command);
    this.removeDraftingId({ challengeId: command.challengeId });

    if (!result.ok) {
      this.commandErrorState.set(result.error);
      return fail(result.error);
    }

    this.replaceChallenge({ challenge: result.value });
    return succeed(result.value);
  }

  async archiveChallenge(
    command: ArchiveChallengeCommand,
  ): Promise<Result<ChallengeFailure, Challenge>> {
    this.archivingIdsState.update((challengeIds) => [...challengeIds, command.challengeId]);
    this.commandErrorState.set(null);

    const result = await this.challengeGateway.archiveChallenge(command);
    this.removeArchivingId({ challengeId: command.challengeId });

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

  async loadChallengeSubmissions(
    command: ListChallengeSubmissionsCommand,
  ): Promise<Result<ChallengeFailure, readonly Submission[]>> {
    this.loadingSubmissionChallengeIdsState.update((challengeIds) =>
      challengeIds.includes(command.challengeId)
        ? challengeIds
        : [...challengeIds, command.challengeId],
    );
    this.commandErrorState.set(null);

    const result = await this.challengeGateway.listChallengeSubmissions(command);
    this.removeLoadingSubmissionChallengeId({ challengeId: command.challengeId });

    if (!result.ok) {
      this.commandErrorState.set(result.error);
      return fail(result.error);
    }

    this.challengeSubmissionsByChallengeIdState.update((submissionsByChallengeId) => ({
      ...submissionsByChallengeId,
      [command.challengeId]: result.value,
    }));
    this.loadedSubmissionChallengeIdsState.update((challengeIds) =>
      challengeIds.includes(command.challengeId)
        ? challengeIds
        : [...challengeIds, command.challengeId],
    );
    return succeed(result.value);
  }

  async loadMissingChallengeSubmissions(input: {
    readonly challengeIds: readonly ChallengeId[];
  }): Promise<void> {
    const missingChallengeIds = input.challengeIds.filter(
      (challengeId) =>
        !this.loadedSubmissionChallengeIds().includes(challengeId) &&
        !this.loadingSubmissionChallengeIds().includes(challengeId),
    );

    await Promise.all(
      missingChallengeIds.map((challengeId) => this.loadChallengeSubmissions({ challengeId })),
    );
  }

  async acceptSubmission(input: {
    readonly challengeId: ChallengeId;
    readonly submissionId: SubmissionId;
  }): Promise<Result<ChallengeFailure, Submission>> {
    return this.decideSubmission({
      challengeId: input.challengeId,
      submissionId: input.submissionId,
      decision: 'accept',
    });
  }

  async rejectSubmission(input: {
    readonly challengeId: ChallengeId;
    readonly submissionId: SubmissionId;
  }): Promise<Result<ChallengeFailure, Submission>> {
    return this.decideSubmission({
      challengeId: input.challengeId,
      submissionId: input.submissionId,
      decision: 'reject',
    });
  }

  isPublishing(input: { readonly challengeId: string }): boolean {
    return this.publishingIds().includes(input.challengeId);
  }

  isDrafting(input: { readonly challengeId: string }): boolean {
    return this.draftingIds().includes(input.challengeId);
  }

  isArchiving(input: { readonly challengeId: string }): boolean {
    return this.archivingIds().includes(input.challengeId);
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

  submissionsForChallenge(input: { readonly challengeId: string }): readonly Submission[] {
    return this.challengeSubmissionsByChallengeIdState()[input.challengeId] ?? [];
  }

  hasAssessedSubmissionForChallenge(input: { readonly challengeId: string }): boolean {
    return this.submissionsForChallenge({ challengeId: input.challengeId }).some(
      (submission) => submission.status === 'accepted' || submission.status === 'rejected',
    );
  }

  isLoadingChallengeSubmissions(input: { readonly challengeId: string }): boolean {
    return this.loadingSubmissionChallengeIds().includes(input.challengeId);
  }

  isDecidingSubmission(input: { readonly submissionId: string }): boolean {
    return this.decidingSubmissionIds().includes(input.submissionId);
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

  private removeDraftingId(input: { readonly challengeId: string }): void {
    this.draftingIdsState.update((challengeIds) =>
      challengeIds.filter((challengeId) => challengeId !== input.challengeId),
    );
  }

  private removeArchivingId(input: { readonly challengeId: string }): void {
    this.archivingIdsState.update((challengeIds) =>
      challengeIds.filter((challengeId) => challengeId !== input.challengeId),
    );
  }

  private removeSubmittingProposalId(input: { readonly challengeId: string }): void {
    this.submittingProposalIdsState.update((challengeIds) =>
      challengeIds.filter((challengeId) => challengeId !== input.challengeId),
    );
  }

  private async decideSubmission(input: {
    readonly challengeId: ChallengeId;
    readonly submissionId: SubmissionId;
    readonly decision: 'accept' | 'reject';
  }): Promise<Result<ChallengeFailure, Submission>> {
    this.decidingSubmissionIdsState.update((submissionIds) => [
      ...submissionIds,
      input.submissionId,
    ]);
    this.commandErrorState.set(null);

    const result = await this.runSubmissionDecision(input);
    this.removeDecidingSubmissionId({ submissionId: input.submissionId });

    if (!result.ok) {
      this.commandErrorState.set(result.error);
      return fail(result.error);
    }

    this.replaceSubmission({ challengeId: input.challengeId, submission: result.value });
    return succeed(result.value);
  }

  private runSubmissionDecision(input: {
    readonly challengeId: ChallengeId;
    readonly submissionId: SubmissionId;
    readonly decision: 'accept' | 'reject';
  }): Promise<Result<ChallengeFailure, Submission>> {
    const command: DecideSubmissionCommand = {
      challengeId: input.challengeId,
      submissionId: input.submissionId,
    };

    return input.decision === 'accept'
      ? this.challengeGateway.acceptSubmission(command)
      : this.challengeGateway.rejectSubmission(command);
  }

  private replaceSubmission(input: {
    readonly challengeId: ChallengeId;
    readonly submission: Submission;
  }): void {
    this.challengeSubmissionsByChallengeIdState.update((submissionsByChallengeId) => {
      const currentSubmissions = submissionsByChallengeId[input.challengeId] ?? [];

      return {
        ...submissionsByChallengeId,
        [input.challengeId]: currentSubmissions.map((submission) =>
          submission.id === input.submission.id ? input.submission : submission,
        ),
      };
    });
  }

  private removeLoadingSubmissionChallengeId(input: { readonly challengeId: string }): void {
    this.loadingSubmissionChallengeIdsState.update((challengeIds) =>
      challengeIds.filter((challengeId) => challengeId !== input.challengeId),
    );
  }

  private removeDecidingSubmissionId(input: { readonly submissionId: string }): void {
    this.decidingSubmissionIdsState.update((submissionIds) =>
      submissionIds.filter((submissionId) => submissionId !== input.submissionId),
    );
  }
}

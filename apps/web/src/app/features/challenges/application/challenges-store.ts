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
  type ChallengeOpportunity,
  type CursorPage,
  type CreateChallengeCommand,
  type DecideSubmissionCommand,
  type DraftChallengeCommand,
  type ListChallengeSubmissionsCommand,
  type ListSubmissionDecisionAuditsCommand,
  type PublishChallengeCommand,
  type SubmitChallengeProposalCommand,
  type UpdateChallengeCommand,
} from './challenge-gateway';
import { canPublishChallenge, type Challenge } from '../domain/challenge';
import type { Submission, SubmissionDecisionAudit } from '../domain/submission';

@Service()
export class ChallengesStore {
  private readonly authSession = inject(AuthSession);
  private readonly challengeGateway = inject(CHALLENGE_GATEWAY);
  private readonly challengesResource = resource({
    defaultValue: succeed<readonly Challenge[]>([]),
    loader: () => this.challengeGateway.listChallenges(),
  });
  private readonly myOpportunitiesResource = resource({
    defaultValue: succeed<CursorPage<ChallengeOpportunity>>(emptyCursorPage()),
    loader: () => {
      const actor = this.authSession.currentActor();

      return actor?.role === 'startup-member'
        ? this.challengeGateway.listMyOpportunities()
        : Promise.resolve(succeed<CursorPage<ChallengeOpportunity>>(emptyCursorPage()));
    },
  });
  private readonly savingState = signal(false);
  private readonly archivingIdsState = signal<readonly string[]>([]);
  private readonly draftingIdsState = signal<readonly string[]>([]);
  private readonly publishingIdsState = signal<readonly string[]>([]);
  private readonly submittingProposalIdsState = signal<readonly string[]>([]);
  private readonly loadingSubmissionChallengeIdsState = signal<readonly string[]>([]);
  private readonly loadingMoreSubmissionChallengeIdsState = signal<readonly string[]>([]);
  private readonly loadedSubmissionChallengeIdsState = signal<readonly string[]>([]);
  private readonly loadingSubmissionAuditIdsState = signal<readonly string[]>([]);
  private readonly loadedSubmissionAuditIdsState = signal<readonly string[]>([]);
  private readonly decidingSubmissionIdsState = signal<readonly string[]>([]);
  private readonly challengeSubmissionsByChallengeIdState = signal<
    Record<string, readonly Submission[]>
  >({});
  private readonly challengeSubmissionPageByChallengeIdState = signal<
    Record<string, CursorPage<Submission>['page']>
  >({});
  private readonly submissionAuditsBySubmissionIdState = signal<
    Record<string, readonly SubmissionDecisionAudit[]>
  >({});
  private readonly loadingMoreMyOpportunitiesState = signal(false);
  private readonly commandErrorState = signal<ChallengeFailure | null>(null);

  readonly challenges = computed(() => {
    const result = this.challengesResource.value();

    return result.ok ? result.value : [];
  });
  readonly mySubmissions = computed(() => {
    const result = this.myOpportunitiesResource.value();

    return result.ok ? result.value.items.map((opportunity) => opportunity.submission) : [];
  });
  readonly myOpportunities = computed(() => {
    const result = this.myOpportunitiesResource.value();

    return result.ok ? result.value.items : [];
  });
  readonly myOpportunityChallenges = computed(() => {
    const challengeById = new Map<string, Challenge>();

    this.myOpportunities().forEach((opportunity) => {
      challengeById.set(opportunity.challenge.id, opportunity.challenge);
    });

    return [...challengeById.values()];
  });
  readonly loading = this.challengesResource.isLoading;
  readonly loadingMySubmissions = this.myOpportunitiesResource.isLoading;
  readonly loadingMoreMyOpportunities = this.loadingMoreMyOpportunitiesState.asReadonly();
  readonly hasMoreMyOpportunities = computed(() => {
    const result = this.myOpportunitiesResource.value();

    return result.ok && result.value.page.nextCursor !== null;
  });
  readonly saving = this.savingState.asReadonly();
  readonly archivingIds = this.archivingIdsState.asReadonly();
  readonly draftingIds = this.draftingIdsState.asReadonly();
  readonly publishingIds = this.publishingIdsState.asReadonly();
  readonly submittingProposalIds = this.submittingProposalIdsState.asReadonly();
  readonly loadingSubmissionChallengeIds = this.loadingSubmissionChallengeIdsState.asReadonly();
  readonly loadingMoreSubmissionChallengeIds =
    this.loadingMoreSubmissionChallengeIdsState.asReadonly();
  readonly loadedSubmissionChallengeIds = this.loadedSubmissionChallengeIdsState.asReadonly();
  readonly loadingSubmissionAuditIds = this.loadingSubmissionAuditIdsState.asReadonly();
  readonly loadedSubmissionAuditIds = this.loadedSubmissionAuditIdsState.asReadonly();
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

    const myOpportunitiesResult = this.myOpportunitiesResource.value();

    return myOpportunitiesResult.ok ? null : myOpportunitiesResult.error;
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
    const reloadedOpportunities = this.myOpportunitiesResource.reload();

    return reloadedChallenges || reloadedOpportunities;
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

    this.addMyOpportunityFromSubmission({ submission: result.value });
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

    const result = await this.challengeGateway.listChallengeSubmissions({
      challengeId: command.challengeId,
      cursor: command.cursor ?? null,
    });
    this.removeLoadingSubmissionChallengeId({ challengeId: command.challengeId });

    if (!result.ok) {
      this.commandErrorState.set(result.error);
      return fail(result.error);
    }

    this.challengeSubmissionsByChallengeIdState.update((submissionsByChallengeId) => ({
      ...submissionsByChallengeId,
      [command.challengeId]: result.value.items,
    }));
    this.challengeSubmissionPageByChallengeIdState.update((pagesByChallengeId) => ({
      ...pagesByChallengeId,
      [command.challengeId]: result.value.page,
    }));
    this.loadedSubmissionChallengeIdsState.update((challengeIds) =>
      challengeIds.includes(command.challengeId)
        ? challengeIds
        : [...challengeIds, command.challengeId],
    );
    return succeed(result.value.items);
  }

  async loadMoreChallengeSubmissions(input: {
    readonly challengeId: ChallengeId;
  }): Promise<Result<ChallengeFailure, readonly Submission[]>> {
    const nextCursor =
      this.challengeSubmissionPageByChallengeIdState()[input.challengeId]?.nextCursor;

    if (nextCursor === null || nextCursor === undefined) {
      return succeed(this.submissionsForChallenge({ challengeId: input.challengeId }));
    }

    if (this.isLoadingMoreChallengeSubmissions({ challengeId: input.challengeId })) {
      return succeed(this.submissionsForChallenge({ challengeId: input.challengeId }));
    }

    this.loadingMoreSubmissionChallengeIdsState.update((challengeIds) => [
      ...challengeIds,
      input.challengeId,
    ]);
    this.commandErrorState.set(null);

    const result = await this.challengeGateway.listChallengeSubmissions({
      challengeId: input.challengeId,
      cursor: nextCursor,
    });
    this.removeLoadingMoreSubmissionChallengeId({ challengeId: input.challengeId });

    if (!result.ok) {
      this.commandErrorState.set(result.error);
      return fail(result.error);
    }

    this.challengeSubmissionsByChallengeIdState.update((submissionsByChallengeId) => ({
      ...submissionsByChallengeId,
      [input.challengeId]: mergeSubmissions({
        currentSubmissions: submissionsByChallengeId[input.challengeId] ?? [],
        nextSubmissions: result.value.items,
      }),
    }));
    this.challengeSubmissionPageByChallengeIdState.update((pagesByChallengeId) => ({
      ...pagesByChallengeId,
      [input.challengeId]: result.value.page,
    }));

    return succeed(this.submissionsForChallenge({ challengeId: input.challengeId }));
  }

  async loadMoreMyOpportunities(): Promise<
    Result<ChallengeFailure, CursorPage<ChallengeOpportunity>>
  > {
    const currentResult = this.myOpportunitiesResource.value();

    if (!currentResult.ok) {
      return fail(currentResult.error);
    }

    const nextCursor = currentResult.value.page.nextCursor;

    if (nextCursor === null) {
      return succeed(currentResult.value);
    }

    if (this.loadingMoreMyOpportunities()) {
      return succeed(currentResult.value);
    }

    this.loadingMoreMyOpportunitiesState.set(true);
    this.commandErrorState.set(null);

    const result = await this.challengeGateway.listMyOpportunities({ cursor: nextCursor });
    this.loadingMoreMyOpportunitiesState.set(false);

    if (!result.ok) {
      this.commandErrorState.set(result.error);
      return fail(result.error);
    }

    const nextPage = {
      items: mergeOpportunities({
        currentOpportunities: currentResult.value.items,
        nextOpportunities: result.value.items,
      }),
      page: result.value.page,
    };

    this.myOpportunitiesResource.update(() => succeed(nextPage));

    return succeed(nextPage);
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

  async loadSubmissionDecisionAudits(
    command: ListSubmissionDecisionAuditsCommand,
  ): Promise<Result<ChallengeFailure, readonly SubmissionDecisionAudit[]>> {
    this.loadingSubmissionAuditIdsState.update((submissionIds) =>
      submissionIds.includes(command.submissionId)
        ? submissionIds
        : [...submissionIds, command.submissionId],
    );
    this.commandErrorState.set(null);

    const result = await this.challengeGateway.listSubmissionDecisionAudits(command);
    this.removeLoadingSubmissionAuditId({ submissionId: command.submissionId });

    if (!result.ok) {
      this.commandErrorState.set(result.error);
      return fail(result.error);
    }

    this.submissionAuditsBySubmissionIdState.update((auditsBySubmissionId) => ({
      ...auditsBySubmissionId,
      [command.submissionId]: result.value,
    }));
    this.loadedSubmissionAuditIdsState.update((submissionIds) =>
      submissionIds.includes(command.submissionId)
        ? submissionIds
        : [...submissionIds, command.submissionId],
    );
    return succeed(result.value);
  }

  async loadMissingSubmissionDecisionAudits(input: {
    readonly challengeId: ChallengeId;
    readonly submissionIds: readonly SubmissionId[];
  }): Promise<void> {
    const missingSubmissionIds = input.submissionIds.filter(
      (submissionId) =>
        !this.loadedSubmissionAuditIds().includes(submissionId) &&
        !this.loadingSubmissionAuditIds().includes(submissionId),
    );

    await Promise.all(
      missingSubmissionIds.map((submissionId) =>
        this.loadSubmissionDecisionAudits({ challengeId: input.challengeId, submissionId }),
      ),
    );
  }

  async acceptSubmission(input: {
    readonly challengeId: ChallengeId;
    readonly submissionId: SubmissionId;
    readonly reason?: string | null | undefined;
  }): Promise<Result<ChallengeFailure, Submission>> {
    return this.decideSubmission({
      challengeId: input.challengeId,
      submissionId: input.submissionId,
      reason: input.reason,
      decision: 'accept',
    });
  }

  async rejectSubmission(input: {
    readonly challengeId: ChallengeId;
    readonly submissionId: SubmissionId;
    readonly reason?: string | null | undefined;
  }): Promise<Result<ChallengeFailure, Submission>> {
    return this.decideSubmission({
      challengeId: input.challengeId,
      submissionId: input.submissionId,
      reason: input.reason,
      decision: 'reject',
    });
  }

  async selectSubmission(input: {
    readonly challengeId: ChallengeId;
    readonly submissionId: SubmissionId;
    readonly reason?: string | null | undefined;
  }): Promise<Result<ChallengeFailure, Submission>> {
    return this.decideSubmission({
      challengeId: input.challengeId,
      submissionId: input.submissionId,
      reason: input.reason,
      decision: 'select',
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

  decisionAuditsForSubmission(input: {
    readonly submissionId: string;
  }): readonly SubmissionDecisionAudit[] {
    return this.submissionAuditsBySubmissionIdState()[input.submissionId] ?? [];
  }

  hasAssessedSubmissionForChallenge(input: { readonly challengeId: string }): boolean {
    return this.submissionsForChallenge({ challengeId: input.challengeId }).some(
      (submission) =>
        submission.status === 'accepted' ||
        submission.status === 'rejected' ||
        submission.status === 'selected' ||
        submission.status === 'not-selected',
    );
  }

  isLoadingChallengeSubmissions(input: { readonly challengeId: string }): boolean {
    return this.loadingSubmissionChallengeIds().includes(input.challengeId);
  }

  isLoadingMoreChallengeSubmissions(input: { readonly challengeId: string }): boolean {
    return this.loadingMoreSubmissionChallengeIds().includes(input.challengeId);
  }

  hasMoreChallengeSubmissions(input: { readonly challengeId: string }): boolean {
    return (
      this.challengeSubmissionPageByChallengeIdState()[input.challengeId]?.nextCursor !== null &&
      this.challengeSubmissionPageByChallengeIdState()[input.challengeId]?.nextCursor !== undefined
    );
  }

  isLoadingSubmissionDecisionAudits(input: { readonly submissionId: string }): boolean {
    return this.loadingSubmissionAuditIds().includes(input.submissionId);
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
    readonly decision: 'accept' | 'reject' | 'select';
    readonly reason?: string | null | undefined;
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
    await this.loadSubmissionDecisionAudits({
      challengeId: input.challengeId,
      submissionId: input.submissionId,
    });

    if (input.decision === 'select') {
      await this.loadChallengeSubmissions({ challengeId: input.challengeId });
    }

    return succeed(result.value);
  }

  private runSubmissionDecision(input: {
    readonly challengeId: ChallengeId;
    readonly submissionId: SubmissionId;
    readonly decision: 'accept' | 'reject' | 'select';
    readonly reason?: string | null | undefined;
  }): Promise<Result<ChallengeFailure, Submission>> {
    const command: DecideSubmissionCommand = {
      challengeId: input.challengeId,
      submissionId: input.submissionId,
      reason: input.reason,
    };

    if (input.decision === 'accept') {
      return this.challengeGateway.acceptSubmission(command);
    }

    if (input.decision === 'reject') {
      return this.challengeGateway.rejectSubmission(command);
    }

    return this.challengeGateway.selectSubmission(command);
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
    this.myOpportunitiesResource.update((currentResult) =>
      currentResult.ok
        ? succeed({
            ...currentResult.value,
            items: currentResult.value.items.map((opportunity) =>
              opportunity.submission.id === input.submission.id
                ? { ...opportunity, submission: input.submission }
                : opportunity,
            ),
          })
        : currentResult,
    );
  }

  private addMyOpportunityFromSubmission(input: { readonly submission: Submission }): void {
    const challenge = this.challenges().find(
      (candidate) => candidate.id === input.submission.challengeId,
    );

    if (challenge === undefined) {
      this.myOpportunitiesResource.reload();
      return;
    }

    this.myOpportunitiesResource.update((currentResult) =>
      currentResult.ok
        ? succeed({
            ...currentResult.value,
            items: [{ challenge, submission: input.submission }, ...currentResult.value.items],
          })
        : succeed({
            items: [{ challenge, submission: input.submission }],
            page: { limit: 20, nextCursor: null },
          }),
    );
  }

  private removeLoadingSubmissionChallengeId(input: { readonly challengeId: string }): void {
    this.loadingSubmissionChallengeIdsState.update((challengeIds) =>
      challengeIds.filter((challengeId) => challengeId !== input.challengeId),
    );
  }

  private removeLoadingMoreSubmissionChallengeId(input: { readonly challengeId: string }): void {
    this.loadingMoreSubmissionChallengeIdsState.update((challengeIds) =>
      challengeIds.filter((challengeId) => challengeId !== input.challengeId),
    );
  }

  private removeLoadingSubmissionAuditId(input: { readonly submissionId: string }): void {
    this.loadingSubmissionAuditIdsState.update((submissionIds) =>
      submissionIds.filter((submissionId) => submissionId !== input.submissionId),
    );
  }

  private removeDecidingSubmissionId(input: { readonly submissionId: string }): void {
    this.decidingSubmissionIdsState.update((submissionIds) =>
      submissionIds.filter((submissionId) => submissionId !== input.submissionId),
    );
  }
}

const emptyCursorPage = <TItem>(): CursorPage<TItem> => ({
  items: [],
  page: { limit: 20, nextCursor: null },
});

const mergeOpportunities = (input: {
  readonly currentOpportunities: readonly ChallengeOpportunity[];
  readonly nextOpportunities: readonly ChallengeOpportunity[];
}): readonly ChallengeOpportunity[] => {
  const opportunitiesBySubmissionId = new Map(
    input.currentOpportunities.map((opportunity) => [opportunity.submission.id, opportunity]),
  );

  input.nextOpportunities.forEach((opportunity) => {
    opportunitiesBySubmissionId.set(opportunity.submission.id, opportunity);
  });

  return [...opportunitiesBySubmissionId.values()];
};

const mergeSubmissions = (input: {
  readonly currentSubmissions: readonly Submission[];
  readonly nextSubmissions: readonly Submission[];
}): readonly Submission[] => {
  const submissionsById = new Map(
    input.currentSubmissions.map((submission) => [submission.id, submission]),
  );

  input.nextSubmissions.forEach((submission) => {
    submissionsById.set(submission.id, submission);
  });

  return [...submissionsById.values()];
};

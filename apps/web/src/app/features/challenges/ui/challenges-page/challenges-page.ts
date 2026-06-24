import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import type { ChallengeId } from '@shared/domain/result';
import { AuthSession } from '@shared/auth/auth-session';
import { CHALLENGE_GATEWAY, type ChallengeFailure } from '../../application/challenge-gateway';
import { ChallengesStore } from '../../application/challenges-store';
import { canCreateChallenge, type Challenge } from '../../domain/challenge';
import type { Submission } from '../../domain/submission';
import { HttpChallengeGateway } from '../../infrastructure/http-challenge-gateway';
import { ChallengeCard, type ChallengeCardState } from '../challenge-card/challenge-card';
import { challengeErrorMessage } from '../challenge-error-message';
import {
  ChallengeForm,
  type ChallengeFormSubmitted,
  type ChallengeFormValue,
} from '../challenge-form/challenge-form';
import {
  ChallengeSubmissionForm,
  type ChallengeSubmissionFormSubmitted,
} from '../challenge-submission-form/challenge-submission-form';
import { ChallengeTabs, type ChallengeTabItem } from '../challenge-tabs/challenge-tabs';

type StartupChallengeTab = 'assessed' | 'in-progress' | 'published';
type CompanyChallengeTab = 'archived' | 'draft' | 'assessed' | 'published';
type ChallengeTab = CompanyChallengeTab | StartupChallengeTab;

@Component({
  selector: 'app-challenges-page',
  imports: [Button, ChallengeCard, ChallengeForm, ChallengeSubmissionForm, ChallengeTabs, Dialog],
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly currentActor = inject(AuthSession).currentActor;
  protected readonly challengeFormDialogVisible = signal(false);
  protected readonly selectedChallengeId = signal<ChallengeId | null>(null);
  protected readonly challengeFormDialogError = signal<ChallengeFailure | null>(null);
  protected readonly challengeFormResetKey = signal(0);
  protected readonly proposalDialogVisible = signal(false);
  protected readonly selectedProposalChallengeId = signal<ChallengeId | null>(null);
  protected readonly proposalDialogError = signal<ChallengeFailure | null>(null);
  protected readonly proposalFormResetKey = signal(0);
  protected readonly activeChallengeTab = signal<ChallengeTab>(
    readInitialChallengeTab({ value: this.route.snapshot.queryParamMap.get('tab') }),
  );
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
  protected readonly usesCompanyChallengeTabs = computed(
    () => this.currentActor()?.role === 'company-admin',
  );
  protected readonly displayedChallenges = computed(() => {
    const challenges = this.store.challenges();
    const selectedTab = this.activeChallengeTab();

    if (this.usesCompanyChallengeTabs()) {
      if (selectedTab === 'archived') {
        return challenges.filter((challenge) => challenge.status === 'archived');
      }

      if (selectedTab === 'draft') {
        return challenges.filter((challenge) => challenge.status === 'draft');
      }

      if (selectedTab === 'assessed') {
        return challenges.filter(
          (challenge) =>
            challenge.status !== 'archived' &&
            this.store.hasAssessedSubmissionForChallenge({ challengeId: challenge.id }),
        );
      }

      return challenges.filter(
        (challenge) =>
          challenge.status === 'published' &&
          !this.store.hasAssessedSubmissionForChallenge({ challengeId: challenge.id }),
      );
    }

    if (!this.usesStartupChallengeTabs()) {
      return challenges;
    }

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
          challenge.status === 'published' &&
          this.store.submissionForChallenge({ challengeId: challenge.id })?.status === 'submitted',
      );
    }

    return challenges.filter((challenge) => {
      if (challenge.status !== 'published') {
        return false;
      }

      const submission = this.store.submissionForChallenge({ challengeId: challenge.id });

      return (
        submission?.status === 'accepted' ||
        submission?.status === 'rejected' ||
        submission?.status === 'selected' ||
        submission?.status === 'not-selected'
      );
    });
  });
  protected readonly challengeCards = computed<readonly ChallengeCardViewModel[]>(() =>
    this.displayedChallenges().map((challenge) => ({
      challenge,
      state: this.challengeCardState({ challenge }),
    })),
  );
  protected readonly challengeTabs = computed<readonly ChallengeTabItem[]>(() =>
    this.usesCompanyChallengeTabs() ? companyChallengeTabs : startupChallengeTabs,
  );
  protected readonly openStartupChallengeCount = computed(
    () =>
      this.store
        .challenges()
        .filter(
          (challenge) =>
            challenge.status === 'published' &&
            this.store.submissionForChallenge({ challengeId: challenge.id }) === null,
        ).length,
  );
  protected readonly underReviewStartupChallengeCount = computed(
    () =>
      this.store
        .challenges()
        .filter(
          (challenge) =>
            challenge.status === 'published' &&
            this.store.submissionForChallenge({ challengeId: challenge.id })?.status ===
              'submitted',
        ).length,
  );
  protected readonly assessedStartupChallengeCount = computed(
    () =>
      this.store.challenges().filter((challenge) => {
        if (challenge.status !== 'published') {
          return false;
        }

        const submission = this.store.submissionForChallenge({ challengeId: challenge.id });

        return (
          submission?.status === 'accepted' ||
          submission?.status === 'rejected' ||
          submission?.status === 'selected' ||
          submission?.status === 'not-selected'
        );
      }).length,
  );
  protected readonly draftCompanyChallengeCount = computed(
    () => this.store.challenges().filter((challenge) => challenge.status === 'draft').length,
  );
  protected readonly archivedCompanyChallengeCount = computed(
    () => this.store.challenges().filter((challenge) => challenge.status === 'archived').length,
  );
  protected readonly publishedCompanyChallengeCount = computed(
    () =>
      this.store
        .challenges()
        .filter(
          (challenge) =>
            challenge.status === 'published' &&
            !this.store.hasAssessedSubmissionForChallenge({ challengeId: challenge.id }),
        ).length,
  );
  protected readonly assessedCompanyChallengeCount = computed(
    () =>
      this.store
        .challenges()
        .filter(
          (challenge) =>
            challenge.status !== 'archived' &&
            this.store.hasAssessedSubmissionForChallenge({ challengeId: challenge.id }),
        ).length,
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

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((queryParamMap) => {
      const tab = readInitialChallengeTab({ value: queryParamMap.get('tab') });

      if (tab === this.activeChallengeTab()) {
        return;
      }

      this.activeChallengeTab.set(tab);
    });

    effect(() => {
      const activeTab = this.activeChallengeTab();

      if (this.isAllowedActiveChallengeTab({ tab: activeTab })) {
        return;
      }

      queueMicrotask(() => {
        this.selectChallengeTab({ tab: 'published' });
      });
    });

    effect(() => {
      if (!this.usesCompanyChallengeTabs()) {
        return;
      }

      const publishedChallengeIds = this.store
        .challenges()
        .filter((challenge) => challenge.status === 'published' || challenge.status === 'archived')
        .map((challenge) => challenge.id);

      queueMicrotask(() => {
        void this.store.loadMissingChallengeSubmissions({ challengeIds: publishedChallengeIds });
      });
    });
  }

  protected reloadChallenges(): void {
    this.store.reloadChallenges();
  }

  protected selectChallengeTab(input: { readonly tab: ChallengeTab }): void {
    this.activeChallengeTab.set(input.tab);
    void this.router.navigate(['/challenges'], {
      queryParams: { tab: input.tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private isAllowedActiveChallengeTab(input: { readonly tab: ChallengeTab }): boolean {
    if (this.usesCompanyChallengeTabs()) {
      return input.tab !== 'in-progress';
    }

    if (this.usesStartupChallengeTabs()) {
      return input.tab !== 'archived' && input.tab !== 'draft';
    }

    return input.tab === 'published';
  }

  protected selectChallengeTabValue(input: { readonly tab: string }): void {
    if (!isChallengeTab(input.tab)) {
      return;
    }

    this.selectChallengeTab({ tab: input.tab });
  }

  private challengeCardState(input: { readonly challenge: Challenge }): ChallengeCardState {
    const challengeId = input.challenge.id;
    const submission = this.store.submissionForChallenge({ challengeId });

    return {
      archiving: this.store.isArchiving({ challengeId }),
      assessed: this.isChallengeAssessed({ challengeId, submission }),
      drafting: this.store.isDrafting({ challengeId }),
      loadingSubmissions: this.store.isLoadingChallengeSubmissions({ challengeId }),
      pendingProposalCount: this.pendingProposalCountForChallenge({ challengeId }),
      proposalCount: this.proposalCountForChallenge({ challengeId }),
      proposalStatus: submission?.status ?? null,
      proposalSubmitted: submission !== null,
      publishing: this.store.isPublishing({ challengeId }),
      submittingProposal: this.store.isSubmittingProposal({ challengeId }),
    };
  }

  private isChallengeAssessed(input: {
    readonly challengeId: ChallengeId;
    readonly submission: Submission | null;
  }): boolean {
    if (this.usesCompanyChallengeTabs()) {
      return this.store.hasAssessedSubmissionForChallenge({ challengeId: input.challengeId });
    }

    return (
      input.submission?.status === 'accepted' ||
      input.submission?.status === 'rejected' ||
      input.submission?.status === 'selected' ||
      input.submission?.status === 'not-selected'
    );
  }

  protected proposalCountForChallenge(input: { readonly challengeId: ChallengeId }): number {
    if (!this.usesCompanyChallengeTabs()) {
      return 0;
    }

    return this.store.submissionsForChallenge({ challengeId: input.challengeId }).length;
  }

  protected pendingProposalCountForChallenge(input: { readonly challengeId: ChallengeId }): number {
    if (!this.usesCompanyChallengeTabs()) {
      return 0;
    }

    return this.store
      .submissionsForChallenge({ challengeId: input.challengeId })
      .filter((submission) => submission.status === 'submitted').length;
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

  protected openProposalsPage(input: { readonly challengeId: ChallengeId }): void {
    void this.router.navigate(['/challenges', input.challengeId, 'proposals']);
  }

  protected publishChallenge(input: { readonly challengeId: ChallengeId }): void {
    void this.store.publishChallenge(input);
  }

  protected draftChallenge(input: { readonly challengeId: ChallengeId }): void {
    void this.store.draftChallenge(input);
  }

  protected archiveChallenge(input: { readonly challengeId: ChallengeId }): void {
    void this.store.archiveChallenge(input);
  }

  protected errorMessage(error: ChallengeFailure | null): string {
    return challengeErrorMessage({ error });
  }

  protected challengeFormDialogErrorMessage(): string | null {
    const error = this.challengeFormDialogError();

    return error === null ? null : challengeErrorMessage({ error });
  }

  protected proposalDialogErrorMessage(): string | null {
    const error = this.proposalDialogError();

    return error === null ? null : challengeErrorMessage({ error });
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

const challengeTabs = ['archived', 'assessed', 'draft', 'in-progress', 'published'] as const;

const companyChallengeTabs: readonly ChallengeTabItem[] = [
  { icon: 'pi pi-file', label: 'Draft', value: 'draft' },
  { icon: 'pi pi-send', label: 'Published', value: 'published' },
  { icon: 'pi pi-check-circle', label: 'Assessed', value: 'assessed' },
  { icon: 'pi pi-box', label: 'Archived', value: 'archived' },
] as const;

const startupChallengeTabs: readonly ChallengeTabItem[] = [
  { icon: 'pi pi-send', label: 'Open', value: 'published' },
  { icon: 'pi pi-clock', label: 'Under review', value: 'in-progress' },
  { icon: 'pi pi-check-circle', label: 'Assessed', value: 'assessed' },
] as const;

type ChallengeCardViewModel = {
  readonly challenge: Challenge;
  readonly state: ChallengeCardState;
};

const isChallengeTab = (value: string | number | undefined): value is ChallengeTab =>
  typeof value === 'string' && challengeTabs.includes(value as ChallengeTab);

const readInitialChallengeTab = (input: { readonly value: string | null }): ChallengeTab => {
  const value = input.value ?? undefined;

  return isChallengeTab(value) ? value : 'published';
};

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  ChallengeDto,
  ChallengeOpportunityDto,
  SubmissionDecisionAuditDto,
  SubmissionDto,
} from '@sparkflow/contracts';
import { firstValueFrom, timeout } from 'rxjs';

import {
  fail,
  type ChallengeId,
  type Result,
  type SubmissionId,
  succeed,
} from '@shared/domain/result';
import { WEB_API_CONFIG } from '@shared/infrastructure/web-api.config';
import type {
  ArchiveChallengeCommand,
  ChallengeFailure,
  ChallengeGateway,
  ChallengeOpportunity,
  CreateChallengeCommand,
  DecideSubmissionCommand,
  DraftChallengeCommand,
  ListChallengeSubmissionsCommand,
  ListSubmissionDecisionAuditsCommand,
  PublishChallengeCommand,
  SubmitChallengeProposalCommand,
  UpdateChallengeCommand,
} from '../application/challenge-gateway';
import type { Challenge } from '../domain/challenge';
import type { Submission, SubmissionDecisionAudit } from '../domain/submission';

const challengeFailures = [
  'challenge-title-required',
  'challenge-description-required',
  'challenge-already-archived',
  'challenge-already-draft',
  'challenge-already-published',
  'challenge-selection-completed',
  'challenge-not-found',
  'challenge-already-selected',
  'submission-not-found',
  'submission-already-decided',
  'submission-not-shortlisted',
  'submission-summary-required',
  'forbidden',
  'network-error',
  'unexpected-error',
] as const;

@Injectable()
export class HttpChallengeGateway implements ChallengeGateway {
  private readonly httpClient = inject(HttpClient);
  private readonly webApiConfig = inject(WEB_API_CONFIG);

  async listChallenges(): Promise<Result<ChallengeFailure, readonly Challenge[]>> {
    try {
      const challengeDtos = await firstValueFrom(
        this.httpClient
          .get<ChallengeDto[]>(this.buildUrl({ path: '/challenges' }))
          .pipe(timeout(5000)),
      );
      return succeed(challengeDtos.map((challengeDto) => toChallenge({ challengeDto })));
    } catch (error: unknown) {
      return fail(toChallengeFailure({ error }));
    }
  }

  async listMySubmissions(): Promise<Result<ChallengeFailure, readonly Submission[]>> {
    try {
      const submissionDtos = await firstValueFrom(
        this.httpClient
          .get<SubmissionDto[]>(this.buildUrl({ path: '/me/submissions' }))
          .pipe(timeout(5000)),
      );
      return succeed(submissionDtos.map((submissionDto) => toSubmission({ submissionDto })));
    } catch (error: unknown) {
      return fail(toChallengeFailure({ error }));
    }
  }

  async listMyOpportunities(): Promise<Result<ChallengeFailure, readonly ChallengeOpportunity[]>> {
    try {
      const opportunityDtos = await firstValueFrom(
        this.httpClient
          .get<ChallengeOpportunityDto[]>(this.buildUrl({ path: '/me/opportunities' }))
          .pipe(timeout(5000)),
      );
      return succeed(
        opportunityDtos.map((opportunityDto) => toChallengeOpportunity({ opportunityDto })),
      );
    } catch (error: unknown) {
      return fail(toChallengeFailure({ error }));
    }
  }

  async listChallengeSubmissions(
    command: ListChallengeSubmissionsCommand,
  ): Promise<Result<ChallengeFailure, readonly Submission[]>> {
    try {
      const submissionDtos = await firstValueFrom(
        this.httpClient
          .get<
            SubmissionDto[]
          >(this.buildUrl({ path: `/challenges/${command.challengeId}/submissions` }))
          .pipe(timeout(5000)),
      );
      return succeed(submissionDtos.map((submissionDto) => toSubmission({ submissionDto })));
    } catch (error: unknown) {
      return fail(toChallengeFailure({ error }));
    }
  }

  async listSubmissionDecisionAudits(
    command: ListSubmissionDecisionAuditsCommand,
  ): Promise<Result<ChallengeFailure, readonly SubmissionDecisionAudit[]>> {
    try {
      const auditDtos = await firstValueFrom(
        this.httpClient
          .get<
            SubmissionDecisionAuditDto[]
          >(this.buildUrl({ path: `/challenges/${command.challengeId}/submissions/${command.submissionId}/decision-audits` }))
          .pipe(timeout(5000)),
      );
      return succeed(auditDtos.map((auditDto) => toSubmissionDecisionAudit({ auditDto })));
    } catch (error: unknown) {
      return fail(toChallengeFailure({ error }));
    }
  }

  async createChallenge(
    command: CreateChallengeCommand,
  ): Promise<Result<ChallengeFailure, Challenge>> {
    try {
      const challengeDto = await firstValueFrom(
        this.httpClient.post<ChallengeDto>(this.buildUrl({ path: '/challenges' }), command),
      );
      return succeed(toChallenge({ challengeDto }));
    } catch (error: unknown) {
      return fail(toChallengeFailure({ error }));
    }
  }

  async updateChallenge(
    command: UpdateChallengeCommand,
  ): Promise<Result<ChallengeFailure, Challenge>> {
    try {
      const challengeDto = await firstValueFrom(
        this.httpClient.patch<ChallengeDto>(
          this.buildUrl({ path: `/challenges/${command.challengeId}` }),
          {
            title: command.title,
            description: command.description,
          },
        ),
      );
      return succeed(toChallenge({ challengeDto }));
    } catch (error: unknown) {
      return fail(toChallengeFailure({ error }));
    }
  }

  async publishChallenge(
    command: PublishChallengeCommand,
  ): Promise<Result<ChallengeFailure, Challenge>> {
    try {
      const challengeDto = await firstValueFrom(
        this.httpClient.post<ChallengeDto>(
          this.buildUrl({ path: `/challenges/${command.challengeId}/publish` }),
          null,
        ),
      );
      return succeed(toChallenge({ challengeDto }));
    } catch (error: unknown) {
      return fail(toChallengeFailure({ error }));
    }
  }

  async draftChallenge(
    command: DraftChallengeCommand,
  ): Promise<Result<ChallengeFailure, Challenge>> {
    try {
      const challengeDto = await firstValueFrom(
        this.httpClient.post<ChallengeDto>(
          this.buildUrl({ path: `/challenges/${command.challengeId}/draft` }),
          null,
        ),
      );
      return succeed(toChallenge({ challengeDto }));
    } catch (error: unknown) {
      return fail(toChallengeFailure({ error }));
    }
  }

  async archiveChallenge(
    command: ArchiveChallengeCommand,
  ): Promise<Result<ChallengeFailure, Challenge>> {
    try {
      const challengeDto = await firstValueFrom(
        this.httpClient.post<ChallengeDto>(
          this.buildUrl({ path: `/challenges/${command.challengeId}/archive` }),
          null,
        ),
      );
      return succeed(toChallenge({ challengeDto }));
    } catch (error: unknown) {
      return fail(toChallengeFailure({ error }));
    }
  }

  async submitChallengeProposal(
    command: SubmitChallengeProposalCommand,
  ): Promise<Result<ChallengeFailure, Submission>> {
    try {
      const submissionDto = await firstValueFrom(
        this.httpClient.post<SubmissionDto>(
          this.buildUrl({ path: `/challenges/${command.challengeId}/submissions` }),
          { summary: command.summary },
        ),
      );
      return succeed(toSubmission({ submissionDto }));
    } catch (error: unknown) {
      return fail(toChallengeFailure({ error }));
    }
  }

  async acceptSubmission(
    command: DecideSubmissionCommand,
  ): Promise<Result<ChallengeFailure, Submission>> {
    return this.decideSubmission({
      challengeId: command.challengeId,
      submissionId: command.submissionId,
      decision: 'accept',
    });
  }

  async rejectSubmission(
    command: DecideSubmissionCommand,
  ): Promise<Result<ChallengeFailure, Submission>> {
    return this.decideSubmission({
      challengeId: command.challengeId,
      submissionId: command.submissionId,
      decision: 'reject',
    });
  }

  async selectSubmission(
    command: DecideSubmissionCommand,
  ): Promise<Result<ChallengeFailure, Submission>> {
    return this.decideSubmission({
      challengeId: command.challengeId,
      submissionId: command.submissionId,
      decision: 'select',
    });
  }

  private buildUrl(input: { readonly path: string }): string {
    return `${this.webApiConfig.apiUrl}${input.path}`;
  }

  private async decideSubmission(input: {
    readonly challengeId: ChallengeId;
    readonly submissionId: SubmissionId;
    readonly decision: 'accept' | 'reject' | 'select';
  }): Promise<Result<ChallengeFailure, Submission>> {
    try {
      const submissionDto = await firstValueFrom(
        this.httpClient.post<SubmissionDto>(
          this.buildUrl({
            path: `/challenges/${input.challengeId}/submissions/${input.submissionId}/${input.decision}`,
          }),
          null,
        ),
      );
      return succeed(toSubmission({ submissionDto }));
    } catch (error: unknown) {
      return fail(toChallengeFailure({ error }));
    }
  }
}

const toChallenge = (input: { readonly challengeDto: ChallengeDto }): Challenge => ({
  id: input.challengeDto.id as ChallengeId,
  title: input.challengeDto.title,
  description: input.challengeDto.description,
  ownerOrganizationId: input.challengeDto.ownerOrganizationId,
  status: input.challengeDto.status,
  createdAt: new Date(input.challengeDto.createdAt),
  publishedAt:
    input.challengeDto.publishedAt === null ? null : new Date(input.challengeDto.publishedAt),
});

const toSubmission = (input: { readonly submissionDto: SubmissionDto }): Submission => ({
  id: input.submissionDto.id as SubmissionId,
  challengeId: input.submissionDto.challengeId as ChallengeId,
  startupOrganizationId: input.submissionDto.startupOrganizationId,
  summary: input.submissionDto.summary,
  status: input.submissionDto.status,
  createdAt: new Date(input.submissionDto.createdAt),
  decidedAt:
    input.submissionDto.decidedAt === null ? null : new Date(input.submissionDto.decidedAt),
});

const toSubmissionDecisionAudit = (input: {
  readonly auditDto: SubmissionDecisionAuditDto;
}): SubmissionDecisionAudit => ({
  id: input.auditDto.id,
  submissionId: input.auditDto.submissionId as SubmissionId,
  challengeId: input.auditDto.challengeId as ChallengeId,
  decidedByUserId: input.auditDto.decidedByUserId,
  decidedByUserEmail: input.auditDto.decidedByUserEmail,
  decidedByOrganizationId: input.auditDto.decidedByOrganizationId,
  decidedByRole: input.auditDto.decidedByRole,
  previousStatus: input.auditDto.previousStatus,
  newStatus: input.auditDto.newStatus,
  decidedAt: new Date(input.auditDto.decidedAt),
  reason: input.auditDto.reason,
});

const toChallengeOpportunity = (input: {
  readonly opportunityDto: ChallengeOpportunityDto;
}): ChallengeOpportunity => ({
  challenge: toChallenge({ challengeDto: input.opportunityDto.challenge }),
  submission: toSubmission({ submissionDto: input.opportunityDto.submission }),
});

const toChallengeFailure = (input: { readonly error: unknown }): ChallengeFailure => {
  if (input.error instanceof HttpErrorResponse && isBackendError(input.error.error)) {
    return input.error.error.error;
  }

  if (input.error instanceof HttpErrorResponse && input.error.status === 0) {
    return 'network-error';
  }

  return 'unexpected-error';
};

const isBackendError = (value: unknown): value is { readonly error: ChallengeFailure } => {
  if (typeof value !== 'object' || value === null || !('error' in value)) {
    return false;
  }

  return isChallengeFailure(value.error);
};

const isChallengeFailure = (value: unknown): value is ChallengeFailure =>
  typeof value === 'string' && challengeFailures.includes(value as ChallengeFailure);

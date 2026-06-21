import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { ChallengeDto } from '@sparkflow/contracts';
import { firstValueFrom, timeout } from 'rxjs';

import { fail, type ChallengeId, type Result, succeed } from '@shared/domain/result';
import { WEB_API_CONFIG } from '@shared/infrastructure/web-api.config';
import type {
  ChallengeFailure,
  ChallengeGateway,
  CreateChallengeCommand,
  PublishChallengeCommand,
} from '../application/challenge-gateway';
import type { Challenge } from '../domain/challenge';

const challengeFailures = [
  'challenge-title-required',
  'challenge-description-required',
  'challenge-already-published',
  'challenge-not-found',
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

  private buildUrl(input: { readonly path: string }): string {
    return `${this.webApiConfig.apiUrl}${input.path}`;
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

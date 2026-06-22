import type { SubmissionStatus } from '@sparkflow/contracts';
import { ChallengeId, SubmissionId } from '@shared/domain/result';

export type Submission = {
  readonly id: SubmissionId;
  readonly challengeId: ChallengeId;
  readonly startupOrganizationId: string;
  readonly summary: string;
  readonly status: SubmissionStatus;
  readonly createdAt: Date;
  readonly decidedAt: Date | null;
};

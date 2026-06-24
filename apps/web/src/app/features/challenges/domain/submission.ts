import type { SubmissionStatus, UserRole } from '@sparkflow/contracts';
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

export type SubmissionDecisionAudit = {
  readonly id: string;
  readonly submissionId: SubmissionId;
  readonly challengeId: ChallengeId;
  readonly decidedByUserId: string;
  readonly decidedByUserEmail: string | null;
  readonly decidedByOrganizationId: string;
  readonly decidedByRole: UserRole;
  readonly previousStatus: SubmissionStatus;
  readonly newStatus: SubmissionStatus;
  readonly decidedAt: Date;
  readonly reason: string | null;
};

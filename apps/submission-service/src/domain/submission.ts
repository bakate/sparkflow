import type {
  ActorContext,
  SubmissionDecisionAuditDto,
  SubmissionDto,
  SubmissionStatus,
} from "@sparkflow/contracts";

export type Submission = {
  readonly id: string;
  readonly challengeId: string;
  readonly startupOrganizationId: string;
  readonly summary: string;
  readonly status: SubmissionStatus;
  readonly createdAt: Date;
  readonly decidedAt: Date | null;
};

export type SubmissionError =
  | "submission-summary-required"
  | "submission-already-decided"
  | "challenge-already-selected"
  | "submission-not-shortlisted"
  | "submission-not-found";

export type SubmissionDecisionAudit = {
  readonly id: string;
  readonly submissionId: string;
  readonly challengeId: string;
  readonly decidedByUserId: string;
  readonly decidedByUserEmail: string | null;
  readonly decidedByOrganizationId: string;
  readonly decidedByRole: ActorContext["role"];
  readonly previousStatus: SubmissionStatus;
  readonly newStatus: SubmissionStatus;
  readonly decidedAt: Date;
  readonly reason: string | null;
};

export const createSubmission = (input: {
  readonly id: string;
  readonly challengeId: string;
  readonly startupOrganizationId: string;
  readonly summary: string;
  readonly now: Date;
}): Submission => ({
  id: input.id,
  challengeId: input.challengeId,
  startupOrganizationId: input.startupOrganizationId,
  summary: input.summary.trim(),
  status: "submitted",
  createdAt: input.now,
  decidedAt: null,
});

export const acceptSubmission = (input: {
  readonly submission: Submission;
  readonly now: Date;
}): Submission => ({
  ...input.submission,
  status: "accepted",
  decidedAt: input.now,
});

export const rejectSubmission = (input: {
  readonly submission: Submission;
  readonly now: Date;
}): Submission => ({
  ...input.submission,
  status: "rejected",
  decidedAt: input.now,
});

export const selectSubmission = (input: {
  readonly submission: Submission;
  readonly now: Date;
}): Submission => ({
  ...input.submission,
  status: "selected",
  decidedAt: input.now,
});

export const markSubmissionNotSelected = (input: {
  readonly submission: Submission;
  readonly now: Date;
}): Submission => ({
  ...input.submission,
  status: "not-selected",
  decidedAt: input.now,
});

export const toSubmissionDto = (submission: Submission): SubmissionDto => ({
  id: submission.id,
  challengeId: submission.challengeId,
  startupOrganizationId: submission.startupOrganizationId,
  summary: submission.summary,
  status: submission.status,
  createdAt: submission.createdAt.toISOString(),
  decidedAt: submission.decidedAt?.toISOString() ?? null,
});

export const createSubmissionDecisionAudit = (input: {
  readonly id: string;
  readonly actor: ActorContext;
  readonly previousSubmission: Submission;
  readonly decidedSubmission: Submission;
  readonly decidedAt: Date;
  readonly reason?: string | null;
}): SubmissionDecisionAudit => ({
  id: input.id,
  submissionId: input.decidedSubmission.id,
  challengeId: input.decidedSubmission.challengeId,
  decidedByUserId: input.actor.userId,
  decidedByUserEmail: input.actor.userEmail ?? null,
  decidedByOrganizationId: input.actor.organizationId,
  decidedByRole: input.actor.role,
  previousStatus: input.previousSubmission.status,
  newStatus: input.decidedSubmission.status,
  decidedAt: input.decidedAt,
  reason: input.reason ?? null,
});

export const toSubmissionDecisionAuditDto = (
  audit: SubmissionDecisionAudit,
): SubmissionDecisionAuditDto => ({
  id: audit.id,
  submissionId: audit.submissionId,
  challengeId: audit.challengeId,
  decidedByUserId: audit.decidedByUserId,
  decidedByUserEmail: audit.decidedByUserEmail,
  decidedByOrganizationId: audit.decidedByOrganizationId,
  decidedByRole: audit.decidedByRole,
  previousStatus: audit.previousStatus,
  newStatus: audit.newStatus,
  decidedAt: audit.decidedAt.toISOString(),
  reason: audit.reason,
});

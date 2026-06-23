import type { SubmissionDto, SubmissionStatus } from "@sparkflow/contracts";

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

export const toSubmissionDto = (submission: Submission): SubmissionDto => ({
  id: submission.id,
  challengeId: submission.challengeId,
  startupOrganizationId: submission.startupOrganizationId,
  summary: submission.summary,
  status: submission.status,
  createdAt: submission.createdAt.toISOString(),
  decidedAt: submission.decidedAt?.toISOString() ?? null,
});

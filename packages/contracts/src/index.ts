export const roles = ["company-admin", "startup-member", "reviewer"] as const;
export type UserRole = (typeof roles)[number];

export type ActorContext = {
  readonly userId: string;
  readonly userEmail?: string | null;
  readonly organizationId: string;
  readonly role: UserRole;
};

export const eventNames = {
  challengePublished: "challenge.published",
  submissionCreated: "submission.created",
  evaluationSubmitted: "evaluation.submitted",
  submissionAccepted: "submission.accepted",
  submissionRejected: "submission.rejected",
  submissionSelected: "submission.selected",
  notificationCreated: "notification.created",
} as const;

export type EventName = (typeof eventNames)[keyof typeof eventNames];

export type DomainEvent<TPayload = unknown> = {
  readonly eventId: string;
  readonly eventName: EventName;
  readonly occurredAt: string;
  readonly correlationId: string;
  readonly producer: string;
  readonly payload: TPayload;
};

export type ChallengeStatus = "archived" | "draft" | "published" | "selection-completed";

export type ChallengeDto = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly ownerOrganizationId: string;
  readonly status: ChallengeStatus;
  readonly createdAt: string;
  readonly publishedAt: string | null;
};

export type SubmissionStatus = "submitted" | "accepted" | "rejected" | "selected" | "not-selected";

export type SubmissionDto = {
  readonly id: string;
  readonly challengeId: string;
  readonly startupOrganizationId: string;
  readonly summary: string;
  readonly status: SubmissionStatus;
  readonly createdAt: string;
  readonly decidedAt: string | null;
};

export type SubmissionDecisionAuditDto = {
  readonly id: string;
  readonly submissionId: string;
  readonly challengeId: string;
  readonly decidedByUserId: string;
  readonly decidedByUserEmail: string | null;
  readonly decidedByOrganizationId: string;
  readonly decidedByRole: UserRole;
  readonly previousStatus: SubmissionStatus;
  readonly newStatus: SubmissionStatus;
  readonly decidedAt: string;
  readonly reason: string | null;
};

export const normalizeSubmissionDecisionReason = (input: {
  readonly reason?: string | null | undefined;
}): string | null => {
  if (input.reason === undefined || input.reason === null) {
    return null;
  }

  const trimmedReason = input.reason.trim();

  return trimmedReason.length === 0 ? null : trimmedReason;
};

export type ChallengeOpportunityDto = {
  readonly challenge: ChallengeDto;
  readonly submission: SubmissionDto;
};

export type EvaluationRecommendation = "strong-fit" | "possible-fit" | "not-fit";

export type EvaluationDto = {
  readonly id: string;
  readonly submissionId: string;
  readonly reviewerId: string;
  readonly score: number;
  readonly recommendation: EvaluationRecommendation;
  readonly comment: string;
  readonly createdAt: string;
};

export type NotificationDto = {
  readonly id: string;
  readonly eventId: string;
  readonly recipientOrganizationId: string;
  readonly title: string;
  readonly message: string;
  readonly createdAt: string;
};

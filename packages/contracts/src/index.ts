export const roles = ["company-admin", "startup-member", "reviewer"] as const;
export type UserRole = (typeof roles)[number];

export type ActorContext = {
  readonly userId: string;
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

export type ChallengeStatus = "archived" | "draft" | "published";

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

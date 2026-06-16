import type { ChallengeDto, ChallengeStatus } from "@sparkflow/contracts";

export type Challenge = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly ownerOrganizationId: string;
  readonly status: ChallengeStatus;
  readonly createdAt: Date;
  readonly publishedAt: Date | null;
};

export type CreateChallengeInput = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly ownerOrganizationId: string;
  readonly now: Date;
};

export type PublishChallengeInput = {
  readonly challenge: Challenge;
  readonly now: Date;
};

export type ChallengeError =
  | "challenge-title-required"
  | "challenge-description-required"
  | "challenge-already-published";

export const createChallenge = (input: CreateChallengeInput): Challenge => ({
  id: input.id,
  title: input.title.trim(),
  description: input.description.trim(),
  ownerOrganizationId: input.ownerOrganizationId,
  status: "draft",
  createdAt: input.now,
  publishedAt: null,
});

export const publishChallenge = (input: PublishChallengeInput): Challenge => ({
  ...input.challenge,
  status: "published",
  publishedAt: input.now,
});

export const toChallengeDto = (challenge: Challenge): ChallengeDto => ({
  id: challenge.id,
  title: challenge.title,
  description: challenge.description,
  ownerOrganizationId: challenge.ownerOrganizationId,
  status: challenge.status,
  createdAt: challenge.createdAt.toISOString(),
  publishedAt: challenge.publishedAt?.toISOString() ?? null,
});

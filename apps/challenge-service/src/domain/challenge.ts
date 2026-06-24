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

export type ArchiveChallengeInput = {
  readonly challenge: Challenge;
};

export type DraftChallengeInput = {
  readonly challenge: Challenge;
};

export type UpdateChallengeInput = {
  readonly challenge: Challenge;
  readonly title: string;
  readonly description: string;
};

export type ChallengeError =
  | "challenge-title-required"
  | "challenge-description-required"
  | "challenge-already-archived"
  | "challenge-already-draft"
  | "challenge-already-published"
  | "challenge-selection-completed";

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

export const archiveChallenge = (input: ArchiveChallengeInput): Challenge => ({
  ...input.challenge,
  status: "archived",
});

export const completeChallengeSelection = (input: {
  readonly challenge: Challenge;
}): Challenge => ({
  ...input.challenge,
  status: "selection-completed",
});

export const draftChallenge = (input: DraftChallengeInput): Challenge => ({
  ...input.challenge,
  status: "draft",
  publishedAt: null,
});

export const updateChallenge = (input: UpdateChallengeInput): Challenge => ({
  ...input.challenge,
  title: input.title.trim(),
  description: input.description.trim(),
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

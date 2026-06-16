import type { ActorContext } from "@sparkflow/contracts";

export const companyAdminActor: ActorContext = {
  userId: "user-company-admin",
  organizationId: "org-company",
  role: "company-admin",
};

export const startupMemberActor: ActorContext = {
  userId: "user-startup-member",
  organizationId: "org-startup",
  role: "startup-member",
};

export const reviewerActor: ActorContext = {
  userId: "user-reviewer",
  organizationId: "org-reviewer",
  role: "reviewer",
};

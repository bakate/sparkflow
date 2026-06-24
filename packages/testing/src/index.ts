import type { ActorContext } from "@sparkflow/contracts";

export const companyAdminActor: ActorContext = {
  userId: "user-company-admin",
  userEmail: "company-admin@sparkflow.test",
  organizationId: "org-company",
  role: "company-admin",
};

export const startupMemberActor: ActorContext = {
  userId: "user-startup-member",
  userEmail: "startup-member@sparkflow.test",
  organizationId: "org-startup",
  role: "startup-member",
};

export const reviewerActor: ActorContext = {
  userId: "user-reviewer",
  userEmail: "reviewer@sparkflow.test",
  organizationId: "org-reviewer",
  role: "reviewer",
};

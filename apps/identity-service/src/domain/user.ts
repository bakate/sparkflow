import type { UserRole } from "@sparkflow/contracts";

export type User = {
  readonly id: string;
  readonly organizationId: string;
  readonly role: UserRole;
  readonly displayName: string;
};

export const seedUsers: readonly User[] = [
  {
    id: "user-company-admin",
    organizationId: "org-company",
    role: "company-admin",
    displayName: "Company admin",
  },
  {
    id: "user-startup-member",
    organizationId: "org-startup",
    role: "startup-member",
    displayName: "Startup member",
  },
  {
    id: "user-reviewer",
    organizationId: "org-reviewer",
    role: "reviewer",
    displayName: "Reviewer",
  },
] as const;

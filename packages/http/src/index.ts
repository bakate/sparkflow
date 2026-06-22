import type { ActorContext, UserRole } from "@sparkflow/contracts";
import { randomUUID } from "node:crypto";

export type HttpHeaders = Record<string, string | string[] | undefined>;

export const readActor = (input: { readonly headers: HttpHeaders }): ActorContext => ({
  userId: readHeaderValue({
    fallback: "anonymous",
    headers: input.headers,
    name: "x-user-id",
  }),
  organizationId: readHeaderValue({
    fallback: "unknown-organization",
    headers: input.headers,
    name: "x-organization-id",
  }),
  role: readHeaderValue({
    fallback: "startup-member",
    headers: input.headers,
    name: "x-role",
  }) as UserRole,
});

export const readCorrelationId = (input: { readonly headers: HttpHeaders }): string =>
  readHeaderValue({
    fallback: randomUUID(),
    headers: input.headers,
    name: "x-correlation-id",
  });

const readHeaderValue = (input: {
  readonly fallback: string;
  readonly headers: HttpHeaders;
  readonly name: string;
}): string => {
  const value = input.headers[input.name];

  if (Array.isArray(value)) {
    return value[0] ?? input.fallback;
  }

  return value ?? input.fallback;
};

import type { ActorContext, CursorPageRequestDto, UserRole } from "@sparkflow/contracts";
import { randomUUID } from "node:crypto";

export type HttpHeaders = Record<string, string | string[] | undefined>;
export type HttpQuery = Record<string, string | string[] | undefined>;
export type PaginationParseResult =
  | { readonly ok: true; readonly value: CursorPageRequestDto }
  | { readonly ok: false; readonly error: "invalid-pagination" };

const defaultPagination = {
  limit: 20,
} as const;
const maxPaginationLimit = 100;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const readActor = (input: { readonly headers: HttpHeaders }): ActorContext => ({
  userId: readHeaderValue({
    fallback: "anonymous",
    headers: input.headers,
    name: "x-user-id",
  }),
  userEmail: readOptionalHeaderValue({
    headers: input.headers,
    name: "x-user-email",
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

export const readPagination = (input: { readonly query: HttpQuery }): PaginationParseResult => {
  const limit = readOptionalPositiveInteger({ query: input.query, name: "limit" });
  const cursor = readOptionalCursor({ query: input.query });

  if (!limit.ok || !cursor.ok) {
    return { ok: false, error: "invalid-pagination" };
  }

  return {
    ok: true,
    value: {
      limit: Math.min(limit.value ?? defaultPagination.limit, maxPaginationLimit),
      cursor: cursor.value,
    },
  };
};

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

const readOptionalHeaderValue = (input: {
  readonly headers: HttpHeaders;
  readonly name: string;
}): string | null => {
  const value = input.headers[input.name];

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

const readOptionalPositiveInteger = (input: {
  readonly query: HttpQuery;
  readonly name: string;
}): { readonly ok: true; readonly value: number | null } | { readonly ok: false } => {
  const rawValue = input.query[input.name];
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;

  if (value === undefined) {
    return { ok: true, value: null };
  }

  if (!/^\d+$/.test(value)) {
    return { ok: false };
  }

  return { ok: true, value: Number(value) };
};

const readOptionalCursor = (input: {
  readonly query: HttpQuery;
}): { readonly ok: true; readonly value: string | null } | { readonly ok: false } => {
  const rawValue = input.query.cursor;
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;

  if (value === undefined || value.length === 0) {
    return { ok: true, value: null };
  }

  if (!uuidPattern.test(value)) {
    return { ok: false };
  }

  return { ok: true, value };
};

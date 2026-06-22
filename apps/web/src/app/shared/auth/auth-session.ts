import { computed, Injectable, signal } from '@angular/core';
import type { ActorContext, UserRole } from '@sparkflow/contracts';

const authRoles = [
  'company-admin',
  'startup-member',
  'reviewer',
] as const satisfies readonly UserRole[];

type RealmAccessClaim = {
  readonly roles?: readonly string[];
};

export type AuthUser = ActorContext & {
  readonly displayName: string;
  readonly username: string;
};

@Injectable({ providedIn: 'root' })
export class AuthSession {
  private readonly accessTokenState = signal<string | null>(null);

  readonly authenticated = computed(() => this.accessTokenState() !== null);
  readonly currentActor = computed(() => {
    const accessToken = this.accessTokenState();

    return accessToken === null ? null : toActor({ accessToken });
  });
  readonly currentUser = computed(() => {
    const accessToken = this.accessTokenState();

    return accessToken === null ? null : toUser({ accessToken });
  });

  accessToken(): string | null {
    return this.accessTokenState();
  }

  replaceAccessToken(input: { readonly accessToken: string | null }): void {
    this.accessTokenState.set(input.accessToken);
  }

  clear(): void {
    this.accessTokenState.set(null);
  }
}

const toActor = (input: { readonly accessToken: string }): ActorContext | null => {
  const payload = decodeAccessTokenPayload({ accessToken: input.accessToken });
  const userId = payload?.['sub'];

  if (payload === null || typeof userId !== 'string') {
    return null;
  }

  const organizationId = readStringClaim({ name: 'organization_id', payload });
  const role = readRole({ payload });

  if (organizationId === null || role === null) {
    return null;
  }

  return {
    userId,
    organizationId,
    role,
  };
};

const toUser = (input: { readonly accessToken: string }): AuthUser | null => {
  const payload = decodeAccessTokenPayload({ accessToken: input.accessToken });
  const actor = payload === null ? null : toActor({ accessToken: input.accessToken });

  if (payload === null || actor === null) {
    return null;
  }

  const username =
    readStringClaim({ name: 'preferred_username', payload }) ??
    readStringClaim({ name: 'email', payload }) ??
    actor.userId;
  const displayName = readStringClaim({ name: 'name', payload }) ?? username;

  return {
    ...actor,
    displayName,
    username,
  };
};

const decodeAccessTokenPayload = (input: {
  readonly accessToken: string;
}): Record<string, unknown> | null => {
  const tokenParts = input.accessToken.split('.');
  const encodedPayload = tokenParts[1];

  if (encodedPayload === undefined) {
    return null;
  }

  try {
    const json = atob(toBase64({ value: encodedPayload }));
    const payload = JSON.parse(json) as unknown;

    return isRecord(payload) ? payload : null;
  } catch {
    return null;
  }
};

const toBase64 = (input: { readonly value: string }): string => {
  const base64 = input.value.replaceAll('-', '+').replaceAll('_', '/');
  const paddingLength = (4 - (base64.length % 4)) % 4;

  return `${base64}${'='.repeat(paddingLength)}`;
};

const readStringClaim = (input: {
  readonly name: string;
  readonly payload: Record<string, unknown>;
}): string | null => {
  const value = input.payload[input.name];

  return typeof value === 'string' && value.length > 0 ? value : null;
};

const readRole = (input: { readonly payload: Record<string, unknown> }): UserRole | null => {
  const realmAccess = input.payload['realm_access'];

  if (!isRealmAccessClaim(realmAccess) || realmAccess.roles === undefined) {
    return null;
  }

  return authRoles.find((role) => realmAccess.roles?.includes(role)) ?? null;
};

const isRealmAccessClaim = (value: unknown): value is RealmAccessClaim =>
  typeof value === 'object' && value !== null;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

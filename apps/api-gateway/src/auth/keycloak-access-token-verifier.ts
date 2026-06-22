import { roles, type ActorContext, type UserRole } from "@sparkflow/contracts";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { AccessTokenVerifier } from "./access-token-verifier.ts";

type RealmAccessClaim = {
  readonly roles?: readonly string[];
};

export const createKeycloakAccessTokenVerifier = (input: {
  readonly clientId: string;
  readonly issuer: string;
}): AccessTokenVerifier => {
  const jwks = createRemoteJWKSet(new URL(`${input.issuer}/protocol/openid-connect/certs`));

  return {
    verify: async ({ authorizationHeader }) => {
      const token = readBearerToken({ authorizationHeader });

      if (token === null) {
        return null;
      }

      try {
        const { payload } = await jwtVerify(token, jwks, {
          issuer: input.issuer,
        });

        return toActor({ clientId: input.clientId, payload });
      } catch {
        return null;
      }
    },
  };
};

const readBearerToken = (input: {
  readonly authorizationHeader: string | undefined;
}): string | null => {
  if (input.authorizationHeader === undefined) {
    return null;
  }

  const [scheme, token] = input.authorizationHeader.split(" ");

  if (scheme !== "Bearer" || token === undefined || token.length === 0) {
    return null;
  }

  return token;
};

const toActor = (input: {
  readonly clientId: string;
  readonly payload: JWTPayload;
}): ActorContext | null => {
  if (input.payload.azp !== input.clientId) {
    return null;
  }

  if (typeof input.payload.sub !== "string") {
    return null;
  }

  const organizationId = readStringClaim({
    name: "organization_id",
    payload: input.payload,
  });
  const role = readRole({ payload: input.payload });

  if (organizationId === null || role === null) {
    return null;
  }

  return {
    organizationId,
    role,
    userId: input.payload.sub,
  };
};

const readStringClaim = (input: {
  readonly name: string;
  readonly payload: JWTPayload;
}): string | null => {
  const value = input.payload[input.name];

  return typeof value === "string" && value.length > 0 ? value : null;
};

const readRole = (input: { readonly payload: JWTPayload }): UserRole | null => {
  const realmAccess = input.payload["realm_access"];

  if (!isRealmAccessClaim(realmAccess) || realmAccess.roles === undefined) {
    return null;
  }

  return roles.find((role) => realmAccess.roles?.includes(role)) ?? null;
};

const isRealmAccessClaim = (value: unknown): value is RealmAccessClaim =>
  typeof value === "object" && value !== null;

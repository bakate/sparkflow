import type { ActorContext } from "@sparkflow/contracts";

export type AccessTokenVerifier = {
  readonly verify: (input: {
    readonly authorizationHeader: string | undefined;
  }) => Promise<ActorContext | null>;
};

import { Pool } from "pg";
import type { ChallengeRepository } from "../application/ports.ts";
import type { Challenge } from "../domain/challenge.ts";

type ChallengeRow = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly owner_organization_id: string;
  readonly status: "draft" | "published";
  readonly created_at: Date;
  readonly published_at: Date | null;
};

const toChallenge = (row: ChallengeRow): Challenge => ({
  id: row.id,
  title: row.title,
  description: row.description,
  ownerOrganizationId: row.owner_organization_id,
  status: row.status,
  createdAt: row.created_at,
  publishedAt: row.published_at,
});

export const createPostgresChallengeRepository = (input: {
  readonly pool: Pool;
}): ChallengeRepository => ({
  save: async ({ challenge }) => {
    await input.pool.query(
      `INSERT INTO challenges (
        id, title, description, owner_organization_id, status, created_at, published_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        published_at = EXCLUDED.published_at`,
      [
        challenge.id,
        challenge.title,
        challenge.description,
        challenge.ownerOrganizationId,
        challenge.status,
        challenge.createdAt,
        challenge.publishedAt,
      ],
    );
  },
  findById: async ({ challengeId }) => {
    const result = await input.pool.query<ChallengeRow>("SELECT * FROM challenges WHERE id = $1", [
      challengeId,
    ]);
    const row = result.rows[0];

    if (row === undefined) {
      return null;
    }

    return toChallenge(row);
  },
  findAll: async () => {
    const result = await input.pool.query<ChallengeRow>(
      "SELECT * FROM challenges ORDER BY created_at DESC",
    );

    return result.rows.map(toChallenge);
  },
});

export const ensureChallengeSchema = async (input: { readonly pool: Pool }): Promise<void> => {
  await input.pool.query(`
    CREATE TABLE IF NOT EXISTS challenges (
      id uuid PRIMARY KEY,
      title text NOT NULL,
      description text NOT NULL,
      owner_organization_id text NOT NULL,
      status text NOT NULL CHECK (status IN ('draft', 'published')),
      created_at timestamptz NOT NULL,
      published_at timestamptz NULL
    )
  `);
};

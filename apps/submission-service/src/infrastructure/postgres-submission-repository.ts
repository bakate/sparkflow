import { Pool } from "pg";
import type { SubmissionRepository } from "../application/ports.ts";
import type { Submission } from "../domain/submission.ts";

type SubmissionRow = {
  readonly id: string;
  readonly challenge_id: string;
  readonly startup_organization_id: string;
  readonly summary: string;
  readonly status: "submitted" | "accepted" | "rejected";
  readonly created_at: Date;
  readonly decided_at: Date | null;
};

const toSubmission = (row: SubmissionRow): Submission => ({
  id: row.id,
  challengeId: row.challenge_id,
  startupOrganizationId: row.startup_organization_id,
  summary: row.summary,
  status: row.status,
  createdAt: row.created_at,
  decidedAt: row.decided_at,
});

export const createPostgresSubmissionRepository = (input: {
  readonly pool: Pool;
}): SubmissionRepository => ({
  save: async ({ submission }) => {
    await input.pool.query(
      `INSERT INTO submissions (
        id, challenge_id, startup_organization_id, summary, status, created_at, decided_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        summary = EXCLUDED.summary,
        status = EXCLUDED.status,
        decided_at = EXCLUDED.decided_at`,
      [
        submission.id,
        submission.challengeId,
        submission.startupOrganizationId,
        submission.summary,
        submission.status,
        submission.createdAt,
        submission.decidedAt,
      ],
    );
  },
  findById: async ({ submissionId }) => {
    const result = await input.pool.query<SubmissionRow>(
      "SELECT * FROM submissions WHERE id = $1",
      [submissionId],
    );
    const row = result.rows[0];

    if (row === undefined) {
      return null;
    }

    return toSubmission(row);
  },
  findByChallengeId: async ({ challengeId }) => {
    const result = await input.pool.query<SubmissionRow>(
      "SELECT * FROM submissions WHERE challenge_id = $1 ORDER BY created_at DESC",
      [challengeId],
    );

    return result.rows.map(toSubmission);
  },
});

export const ensureSubmissionSchema = async (input: { readonly pool: Pool }): Promise<void> => {
  await input.pool.query(`
    CREATE TABLE IF NOT EXISTS submissions (
      id uuid PRIMARY KEY,
      challenge_id uuid NOT NULL,
      startup_organization_id text NOT NULL,
      summary text NOT NULL,
      status text NOT NULL CHECK (status IN ('submitted', 'accepted', 'rejected')),
      created_at timestamptz NOT NULL,
      decided_at timestamptz NULL
    )
  `);
};

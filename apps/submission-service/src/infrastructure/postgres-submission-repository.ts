import { Pool } from "pg";
import { fail, succeed } from "@sparkflow/result";
import type { SubmissionRepository } from "../application/ports.ts";
import type { Submission } from "../domain/submission.ts";

const selectedSubmissionIndexName = "submissions_one_selected_per_challenge_idx";

type SubmissionRow = {
  readonly id: string;
  readonly challenge_id: string;
  readonly startup_organization_id: string;
  readonly summary: string;
  readonly status: "submitted" | "accepted" | "rejected" | "selected";
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
    try {
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

      return succeed(undefined);
    } catch (error: unknown) {
      if (isSelectedSubmissionUniquenessViolation({ error })) {
        return fail("challenge-already-selected");
      }

      throw error;
    }
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
  findByStartupOrganizationId: async ({ startupOrganizationId }) => {
    const result = await input.pool.query<SubmissionRow>(
      "SELECT * FROM submissions WHERE startup_organization_id = $1 ORDER BY created_at DESC",
      [startupOrganizationId],
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
      status text NOT NULL CHECK (status IN ('submitted', 'accepted', 'rejected', 'selected')),
      created_at timestamptz NOT NULL,
      decided_at timestamptz NULL
    )
  `);
  await input.pool.query(`
    ALTER TABLE submissions
    DROP CONSTRAINT IF EXISTS submissions_status_check
  `);
  await input.pool.query(`
    ALTER TABLE submissions
    ADD CONSTRAINT submissions_status_check
    CHECK (status IN ('submitted', 'accepted', 'rejected', 'selected'))
  `);
  await input.pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS submissions_one_selected_per_challenge_idx
    ON submissions (challenge_id)
    WHERE status = 'selected'
  `);
};

const isSelectedSubmissionUniquenessViolation = (input: { readonly error: unknown }): boolean => {
  if (typeof input.error !== "object" || input.error === null) {
    return false;
  }

  if (!("code" in input.error) || !("constraint" in input.error)) {
    return false;
  }

  return input.error.code === "23505" && input.error.constraint === selectedSubmissionIndexName;
};

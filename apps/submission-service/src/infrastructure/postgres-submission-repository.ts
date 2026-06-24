import { Pool, type PoolClient } from "pg";
import { fail, succeed } from "@sparkflow/result";
import type { SubmissionRepository } from "../application/ports.ts";
import type { Submission, SubmissionDecisionAudit } from "../domain/submission.ts";

const selectedSubmissionIndexName = "submissions_one_selected_per_challenge_idx";

type SubmissionRow = {
  readonly id: string;
  readonly challenge_id: string;
  readonly startup_organization_id: string;
  readonly summary: string;
  readonly status: "submitted" | "accepted" | "rejected" | "selected" | "not-selected";
  readonly created_at: Date;
  readonly decided_at: Date | null;
};

type SubmissionDecisionAuditRow = {
  readonly id: string;
  readonly submission_id: string;
  readonly challenge_id: string;
  readonly decided_by_user_id: string;
  readonly decided_by_user_email: string | null;
  readonly decided_by_organization_id: string;
  readonly decided_by_role: "company-admin" | "startup-member" | "reviewer";
  readonly previous_status: "submitted" | "accepted" | "rejected" | "selected" | "not-selected";
  readonly new_status: "submitted" | "accepted" | "rejected" | "selected" | "not-selected";
  readonly decided_at: Date;
  readonly reason: string | null;
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

const toSubmissionDecisionAudit = (row: SubmissionDecisionAuditRow): SubmissionDecisionAudit => ({
  id: row.id,
  submissionId: row.submission_id,
  challengeId: row.challenge_id,
  decidedByUserId: row.decided_by_user_id,
  decidedByUserEmail: row.decided_by_user_email,
  decidedByOrganizationId: row.decided_by_organization_id,
  decidedByRole: row.decided_by_role,
  previousStatus: row.previous_status,
  newStatus: row.new_status,
  decidedAt: row.decided_at,
  reason: row.reason,
});

export const createPostgresSubmissionRepository = (input: {
  readonly pool: Pool;
}): SubmissionRepository => ({
  save: async ({ submission }) => {
    try {
      await saveSubmission({ executor: input.pool, submission });

      return succeed(undefined);
    } catch (error: unknown) {
      if (isSelectedSubmissionUniquenessViolation({ error })) {
        return fail("challenge-already-selected");
      }

      throw error;
    }
  },
  saveMany: async ({ submissions }) => {
    const client = await input.pool.connect();

    try {
      await client.query("BEGIN");

      for (const submission of submissions) {
        await saveSubmission({ executor: client, submission });
      }

      await client.query("COMMIT");
      return succeed(undefined);
    } catch (error: unknown) {
      await client.query("ROLLBACK");

      if (isSelectedSubmissionUniquenessViolation({ error })) {
        return fail("challenge-already-selected");
      }

      throw error;
    } finally {
      client.release();
    }
  },
  saveDecision: async ({ submissions, audits }) => {
    const client = await input.pool.connect();

    try {
      await client.query("BEGIN");

      for (const submission of submissions) {
        await saveSubmission({ executor: client, submission });
      }

      for (const audit of audits) {
        await saveSubmissionDecisionAudit({ executor: client, audit });
      }

      await client.query("COMMIT");
      return succeed(undefined);
    } catch (error: unknown) {
      await client.query("ROLLBACK");

      if (isSelectedSubmissionUniquenessViolation({ error })) {
        return fail("challenge-already-selected");
      }

      throw error;
    } finally {
      client.release();
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
  findDecisionAuditsBySubmissionId: async ({ submissionId }) => {
    const result = await input.pool.query<SubmissionDecisionAuditRow>(
      `SELECT * FROM submission_decision_audits
      WHERE submission_id = $1
      ORDER BY decided_at ASC, id ASC`,
      [submissionId],
    );

    return result.rows.map(toSubmissionDecisionAudit);
  },
});

export const ensureSubmissionSchema = async (input: { readonly pool: Pool }): Promise<void> => {
  await input.pool.query(`
    CREATE TABLE IF NOT EXISTS submissions (
      id uuid PRIMARY KEY,
      challenge_id uuid NOT NULL,
      startup_organization_id text NOT NULL,
      summary text NOT NULL,
      status text NOT NULL CHECK (status IN ('submitted', 'accepted', 'rejected', 'selected', 'not-selected')),
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
    CHECK (status IN ('submitted', 'accepted', 'rejected', 'selected', 'not-selected'))
  `);
  await input.pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS submissions_one_selected_per_challenge_idx
    ON submissions (challenge_id)
    WHERE status = 'selected'
  `);
  await input.pool.query(`
    CREATE TABLE IF NOT EXISTS submission_decision_audits (
      id uuid PRIMARY KEY,
      submission_id uuid NOT NULL,
      challenge_id uuid NOT NULL,
      decided_by_user_id text NOT NULL,
      decided_by_user_email text NULL,
      decided_by_organization_id text NOT NULL,
      decided_by_role text NOT NULL CHECK (decided_by_role IN ('company-admin', 'startup-member', 'reviewer')),
      previous_status text NOT NULL CHECK (previous_status IN ('submitted', 'accepted', 'rejected', 'selected', 'not-selected')),
      new_status text NOT NULL CHECK (new_status IN ('submitted', 'accepted', 'rejected', 'selected', 'not-selected')),
      decided_at timestamptz NOT NULL,
      reason text NULL
    )
  `);
  await input.pool.query(`
    CREATE INDEX IF NOT EXISTS submission_decision_audits_submission_id_idx
    ON submission_decision_audits (submission_id, decided_at)
  `);
};

const saveSubmission = async (input: {
  readonly executor: Pick<Pool | PoolClient, "query">;
  readonly submission: Submission;
}): Promise<void> => {
  await input.executor.query(
    `INSERT INTO submissions (
      id, challenge_id, startup_organization_id, summary, status, created_at, decided_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (id) DO UPDATE SET
      summary = EXCLUDED.summary,
      status = EXCLUDED.status,
      decided_at = EXCLUDED.decided_at`,
    [
      input.submission.id,
      input.submission.challengeId,
      input.submission.startupOrganizationId,
      input.submission.summary,
      input.submission.status,
      input.submission.createdAt,
      input.submission.decidedAt,
    ],
  );
};

const saveSubmissionDecisionAudit = async (input: {
  readonly executor: Pick<Pool | PoolClient, "query">;
  readonly audit: SubmissionDecisionAudit;
}): Promise<void> => {
  await input.executor.query(
    `INSERT INTO submission_decision_audits (
      id,
      submission_id,
      challenge_id,
      decided_by_user_id,
      decided_by_user_email,
      decided_by_organization_id,
      decided_by_role,
      previous_status,
      new_status,
      decided_at,
      reason
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      input.audit.id,
      input.audit.submissionId,
      input.audit.challengeId,
      input.audit.decidedByUserId,
      input.audit.decidedByUserEmail,
      input.audit.decidedByOrganizationId,
      input.audit.decidedByRole,
      input.audit.previousStatus,
      input.audit.newStatus,
      input.audit.decidedAt,
      input.audit.reason,
    ],
  );
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

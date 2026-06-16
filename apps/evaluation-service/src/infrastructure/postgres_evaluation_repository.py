from datetime import UTC
from typing import cast

import asyncpg

from src.domain.evaluation import Evaluation, EvaluationRecommendation


class PostgresEvaluationRepository:
    def __init__(self, *, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def save(self, *, evaluation: Evaluation) -> None:
        async with self._pool.acquire() as connection:
            await connection.execute(
                """
                INSERT INTO evaluations (
                  id, submission_id, reviewer_id, score, recommendation, comment, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                """,
                evaluation.id,
                evaluation.submission_id,
                evaluation.reviewer_id,
                evaluation.score,
                evaluation.recommendation,
                evaluation.comment,
                evaluation.created_at,
            )

    async def find_by_submission_id(self, *, submission_id: str) -> tuple[Evaluation, ...]:
        async with self._pool.acquire() as connection:
            rows = await connection.fetch(
                """
                SELECT * FROM evaluations
                WHERE submission_id = $1
                ORDER BY created_at DESC
                """,
                submission_id,
            )

        return tuple(
            Evaluation(
                id=str(row["id"]),
                submission_id=str(row["submission_id"]),
                reviewer_id=str(row["reviewer_id"]),
                score=int(row["score"]),
                recommendation=cast(EvaluationRecommendation, row["recommendation"]),
                comment=str(row["comment"]),
                created_at=row["created_at"].replace(tzinfo=UTC),
            )
            for row in rows
        )


async def ensure_evaluation_schema(*, pool: asyncpg.Pool) -> None:
    async with pool.acquire() as connection:
        await connection.execute(
            """
            CREATE TABLE IF NOT EXISTS evaluations (
              id uuid PRIMARY KEY,
              submission_id uuid NOT NULL,
              reviewer_id text NOT NULL,
              score integer NOT NULL CHECK (score >= 0 AND score <= 100),
              recommendation text NOT NULL CHECK (
                recommendation IN ('strong-fit', 'possible-fit', 'not-fit')
              ),
              comment text NOT NULL,
              created_at timestamptz NOT NULL
            )
            """
        )

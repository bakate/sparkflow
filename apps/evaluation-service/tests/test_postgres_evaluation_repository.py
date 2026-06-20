import os
from datetime import UTC, datetime

import asyncpg
import pytest
from faker import Faker

from domain.evaluation import Evaluation, create_evaluation
from infrastructure.postgres_evaluation_repository import (
    PostgresEvaluationRepository,
    ensure_evaluation_schema,
)

test_database_url = os.getenv("EVALUATION_SERVICE_TEST_DATABASE_URL")
should_run_integration_tests = (
    test_database_url is not None and len(test_database_url.strip()) > 0
)
faker = Faker()


def require_test_database_url() -> str:
    if test_database_url is None or len(test_database_url.strip()) == 0:
        pytest.fail("EVALUATION_SERVICE_TEST_DATABASE_URL is required")

    return test_database_url


def create_evaluation_fixture(
    *,
    evaluation_id: str,
    submission_id: str,
    reviewer_id: str,
    score: int,
    created_at: datetime,
) -> Evaluation:
    return create_evaluation(
        evaluation_id=evaluation_id,
        submission_id=submission_id,
        reviewer_id=reviewer_id,
        score=score,
        comment=faker.sentence(),
        now=created_at,
    )


@pytest.fixture
async def pool() -> asyncpg.Pool:
    database_pool = await asyncpg.create_pool(require_test_database_url())

    if database_pool is None:
        pytest.fail("Unable to create PostgreSQL pool")

    await ensure_evaluation_schema(pool=database_pool)

    async with database_pool.acquire() as connection:
        await connection.execute("TRUNCATE TABLE evaluations")

    try:
        yield database_pool
    finally:
        await database_pool.close()


@pytest.mark.skipif(
    not should_run_integration_tests,
    reason="EVALUATION_SERVICE_TEST_DATABASE_URL is required",
)
async def test_saves_and_finds_evaluations_by_submission_id(pool: asyncpg.Pool) -> None:
    repository = PostgresEvaluationRepository(pool=pool)
    submission_id = faker.uuid4()
    evaluation = create_evaluation_fixture(
        evaluation_id=faker.uuid4(),
        submission_id=submission_id,
        reviewer_id=faker.uuid4(),
        score=91,
        created_at=datetime(2026, 6, 16, 9, 0, 0, tzinfo=UTC),
    )

    await repository.save(evaluation=evaluation)

    evaluations = await repository.find_by_submission_id(submission_id=submission_id)

    assert len(evaluations) == 1
    assert evaluations[0] == evaluation
    assert await repository.exists_by_submission_id_and_reviewer_id(
        submission_id=submission_id,
        reviewer_id=evaluation.reviewer_id,
    )
    assert not await repository.exists_by_submission_id_and_reviewer_id(
        submission_id=submission_id,
        reviewer_id=faker.uuid4(),
    )


@pytest.mark.skipif(
    not should_run_integration_tests,
    reason="EVALUATION_SERVICE_TEST_DATABASE_URL is required",
)
async def test_lists_evaluations_for_one_submission_from_newest_to_oldest(
    pool: asyncpg.Pool,
) -> None:
    repository = PostgresEvaluationRepository(pool=pool)
    submission_id = faker.uuid4()
    other_submission_id = faker.uuid4()
    older_evaluation = create_evaluation_fixture(
        evaluation_id=faker.uuid4(),
        submission_id=submission_id,
        reviewer_id=faker.uuid4(),
        score=61,
        created_at=datetime(2026, 6, 16, 9, 0, 0, tzinfo=UTC),
    )
    newer_evaluation = create_evaluation_fixture(
        evaluation_id=faker.uuid4(),
        submission_id=submission_id,
        reviewer_id=faker.uuid4(),
        score=91,
        created_at=datetime(2026, 6, 16, 10, 0, 0, tzinfo=UTC),
    )
    unrelated_evaluation = create_evaluation_fixture(
        evaluation_id=faker.uuid4(),
        submission_id=other_submission_id,
        reviewer_id=faker.uuid4(),
        score=31,
        created_at=datetime(2026, 6, 16, 11, 0, 0, tzinfo=UTC),
    )

    await repository.save(evaluation=older_evaluation)
    await repository.save(evaluation=newer_evaluation)
    await repository.save(evaluation=unrelated_evaluation)

    evaluations = await repository.find_by_submission_id(submission_id=submission_id)

    assert [evaluation.id for evaluation in evaluations] == [
        newer_evaluation.id,
        older_evaluation.id,
    ]


@pytest.mark.skipif(
    not should_run_integration_tests,
    reason="EVALUATION_SERVICE_TEST_DATABASE_URL is required",
)
async def test_rejects_duplicate_reviewer_evaluation_for_same_submission(
    pool: asyncpg.Pool,
) -> None:
    repository = PostgresEvaluationRepository(pool=pool)
    submission_id = faker.uuid4()
    reviewer_id = faker.uuid4()
    original_evaluation = create_evaluation_fixture(
        evaluation_id=faker.uuid4(),
        submission_id=submission_id,
        reviewer_id=reviewer_id,
        score=61,
        created_at=datetime(2026, 6, 16, 9, 0, 0, tzinfo=UTC),
    )
    duplicate_evaluation = create_evaluation_fixture(
        evaluation_id=faker.uuid4(),
        submission_id=submission_id,
        reviewer_id=reviewer_id,
        score=91,
        created_at=datetime(2026, 6, 16, 10, 0, 0, tzinfo=UTC),
    )

    await repository.save(evaluation=original_evaluation)

    with pytest.raises(asyncpg.UniqueViolationError):
        await repository.save(evaluation=duplicate_evaluation)

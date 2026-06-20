from datetime import datetime
from typing import Protocol

from domain.evaluation import Evaluation
from infrastructure.contracts import DomainEvent


class EvaluationRepository(Protocol):
    async def save(self, *, evaluation: Evaluation) -> None: ...

    async def find_by_submission_id(self, *, submission_id: str) -> tuple[Evaluation, ...]: ...

    async def exists_by_submission_id_and_reviewer_id(
        self, *, submission_id: str, reviewer_id: str
    ) -> bool: ...


class EventPublisher(Protocol):
    async def publish(self, *, event: DomainEvent) -> None: ...


class Clock(Protocol):
    def now(self) -> datetime: ...


class IdGenerator(Protocol):
    def generate(self) -> str: ...

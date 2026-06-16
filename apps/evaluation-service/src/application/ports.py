from typing import Protocol

from src.domain.evaluation import Evaluation
from src.infrastructure.contracts import DomainEvent


class EvaluationRepository(Protocol):
    async def save(self, *, evaluation: Evaluation) -> None: ...

    async def find_by_submission_id(self, *, submission_id: str) -> tuple[Evaluation, ...]: ...


class EventPublisher(Protocol):
    async def publish(self, *, event: DomainEvent) -> None: ...

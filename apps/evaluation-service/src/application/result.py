from dataclasses import dataclass
from typing import Generic, TypeVar

ErrorType = TypeVar("ErrorType")
ValueType = TypeVar("ValueType")


@dataclass(frozen=True, slots=True)
class Success(Generic[ValueType]):
    value: ValueType


@dataclass(frozen=True, slots=True)
class Failure(Generic[ErrorType]):
    error: ErrorType


type Result[ErrorType, ValueType] = Success[ValueType] | Failure[ErrorType]

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Success[ValueType]:
    value: ValueType


@dataclass(frozen=True, slots=True)
class Failure[ErrorType]:
    error: ErrorType


type Result[ErrorType, ValueType] = Success[ValueType] | Failure[ErrorType]

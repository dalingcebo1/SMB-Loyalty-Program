"""Clock abstraction enabling deterministic tests and future time mocking."""
from __future__ import annotations
import time
from typing import Protocol

class Clock(Protocol):  # pragma: no cover
    def now(self) -> float: ...

class RealClock:
    def now(self) -> float:  # pragma: no cover
        return time.time()

class FrozenClock:
    def __init__(self, start: float | None = None):
        self._t = start if start is not None else time.time()
    def now(self) -> float:
        return self._t
    def advance(self, seconds: float):
        self._t += seconds

_clock: Clock = RealClock()

def now() -> float:
    return _clock.now()

def set_clock(c: Clock):  # pragma: no cover
    global _clock
    _clock = c

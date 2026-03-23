"""Beauty vertical constants."""

from enum import Enum


class AppointmentStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


ACTIVE_STATUSES = ["pending", "confirmed", "in_progress"]

SLOT_INCREMENT_MINUTES = 30

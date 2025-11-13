from datetime import datetime

# Centralized UTC timestamp helper.
# Currently returns a naive datetime in UTC to match existing persistence expectations.
# All code should import and use utc_now() instead of datetime.utcnow();
# this enables a later move to timezone-aware timestamps or monotonic sources.

def utc_now() -> datetime:
    return datetime.utcnow()

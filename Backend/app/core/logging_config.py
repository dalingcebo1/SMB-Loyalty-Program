import logging, json, sys, time
from typing import Any, Dict
from config import settings

class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:  # override (pydantic/logging stubs ok)
        base: Dict[str, Any] = {
            "ts": time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime(record.created)) + f".{int(record.msecs):03d}Z",
            "level": record.levelname,
            "msg": record.getMessage(),
            "logger": record.name,
        }
        if record.exc_info:
            base["exc_type"] = record.exc_info[0].__name__ if record.exc_info[0] else None
        # Optional fields possibly injected on record externally
        for attr in ("request_id", "tenant_id"):
            if hasattr(record, attr):
                base[attr] = getattr(record, attr)
        return json.dumps(base, separators=(",", ":"))

def configure_logging():
    root = logging.getLogger()
    if getattr(root, '_structured_configured', False):
        return
    level = logging.INFO
    root.setLevel(level)
    # Remove default handlers
    for h in list(root.handlers):
        root.removeHandler(h)
    if settings.environment == 'production':
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(JsonFormatter())
        root.addHandler(handler)
    else:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter('%(asctime)s %(levelname)s %(name)s %(message)s'))
        root.addHandler(handler)
    root._structured_configured = True  # mypy: ignore dynamic attribute


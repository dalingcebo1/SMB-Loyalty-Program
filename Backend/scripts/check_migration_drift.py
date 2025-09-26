"""Fail if model definitions differ from latest Alembic migrations.

Approach: Run Alembic autogenerate context in memory and see if new operations
would be produced. If so, print the operations and exit with non-zero status.

Limitations: This is a heuristic and may show false positives for ordering or
server defaults. Tweak include_object / compare_type / compare_server_default
as needed.
"""
from __future__ import annotations
import sys
from io import StringIO
from contextlib import redirect_stdout
from pathlib import Path

from alembic.config import Config
from alembic import command
from alembic.autogenerate.api import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import create_engine

# Import app metadata
from app.core.database import Base  # type: ignore
from config import settings  # type: ignore


def get_alembic_config() -> Config:
    cfg_path = Path(__file__).resolve().parents[1] / "alembic.ini"
    cfg = Config(str(cfg_path))
    cfg.set_main_option("script_location", str(Path(__file__).resolve().parents[1] / "alembic"))
    return cfg


def main() -> int:
    # Use configured database URL (CI should point to ephemeral Postgres)
    engine = create_engine(settings.database_url)
    with engine.connect() as connection:
        # Configure a MigrationContext so autogenerate has the proper wrapper
        # (Passing a raw Connection to compare_metadata raises AttributeError)
        migration_ctx = MigrationContext.configure(connection)
        metadata = Base.metadata
        diffs = compare_metadata(migration_ctx, metadata)
        if diffs:
            print("Detected model vs migration drift:\n")
            for diff in diffs:
                print(f" - {diff}")
            print("\nRun: alembic revision --autogenerate -m 'sync models' and commit the migration.")
            return 1
        print("No migration drift detected.")
        return 0

if __name__ == "__main__":
    raise SystemExit(main())

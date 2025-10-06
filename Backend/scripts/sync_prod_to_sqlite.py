#!/usr/bin/env python3
"""Sync production data into the local SQLite dev database.

This helper copies the contents of a source database (typically production
Postgres) into the SQLite file used for local development/testing. It is
intended for one-off refreshes when you need realistic data locally.

Example usage:
    python Backend/scripts/sync_prod_to_sqlite.py \
        --source-url postgresql+psycopg2://readonly:***@prod-host:5432/appdb \
        --target-path Backend/dev.db --yes

Security note: always use a *read-only* connection string for the production
source. The script truncates/replaces the SQLite database but never mutates the
source database.
"""
from __future__ import annotations

import argparse
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.sql.schema import Table

from app.core.database import Base

# Ensure ORM models are imported so metadata is fully populated.
import app.models  # noqa: F401


DEFAULT_SQLITE_PATH = Path("Backend/dev.db")
DEFAULT_CHUNK_SIZE = 1000


@dataclass(slots=True)
class SyncReport:
    table: str
    rows_copied: int


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source-url",
        default=os.getenv("SOURCE_DATABASE_URL") or os.getenv("DATABASE_URL"),
        help="SQLAlchemy URL for the source database (e.g. production Postgres).",
    )
    parser.add_argument(
        "--target-path",
        type=Path,
        default=DEFAULT_SQLITE_PATH,
        help="Path to the SQLite database file to overwrite (default: Backend/dev.db).",
    )
    parser.add_argument(
        "--tables",
        nargs="*",
        help="Optional subset of tables to sync (defaults to all mapped tables).",
    )
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=DEFAULT_CHUNK_SIZE,
        help="Number of rows to batch per insert (default: %(default)s).",
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Skip confirmation prompt.",
    )
    return parser.parse_args()


def build_sqlite_url(path: Path) -> str:
    return f"sqlite:///{path.resolve()}"


def ensure_target_schema(engine: Engine) -> None:
    """Create tables on the SQLite side if they are missing."""
    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        conn.execute(
            text(
                "CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL)"
            )
        )


def disable_sqlite_foreign_keys(engine: Engine) -> None:
    if engine.url.get_backend_name() == "sqlite":
        with engine.begin() as conn:
            conn.execute(text("PRAGMA foreign_keys = OFF"))


def enable_sqlite_foreign_keys(engine: Engine) -> None:
    if engine.url.get_backend_name() == "sqlite":
        with engine.begin() as conn:
            conn.execute(text("PRAGMA foreign_keys = ON"))


def filtered_tables(requested: Sequence[str] | None) -> list[Table]:
    names = {name.lower() for name in requested} if requested else None
    tables = [tbl for tbl in Base.metadata.sorted_tables if not names or tbl.name.lower() in names]
    if not tables:
        raise SystemExit("No tables selected for sync. Check --tables arguments.")
    return tables


def wipe_tables(engine: Engine, tables: Iterable[Table]) -> None:
    with engine.begin() as conn:
        for table in tables:
            conn.execute(table.delete())


def copy_table(source: Engine, target: Engine, table: Table, chunk_size: int) -> int:
    rows_copied = 0
    with source.connect() as src_conn:
        result = src_conn.execute(table.select())
        while True:
            chunk = result.fetchmany(chunk_size)
            if not chunk:
                break
            payload = [dict(row._mapping) for row in chunk]
            if payload:
                with target.begin() as tgt_conn:
                    tgt_conn.execute(table.insert(), payload)
                rows_copied += len(payload)
    return rows_copied


def sync_alembic_version(source: Engine, target: Engine) -> None:
    try:
        with source.connect() as src_conn:
            rows = src_conn.execute(text("SELECT version_num FROM alembic_version")).fetchall()
    except SQLAlchemyError:
        # Table missing on source – skip without failing the sync.
        return
    with target.begin() as tgt_conn:
        tgt_conn.execute(text("DELETE FROM alembic_version"))
        if rows:
            payload = [{"version_num": row[0]} for row in rows]
            tgt_conn.execute(text("INSERT INTO alembic_version (version_num) VALUES (:version_num)"), payload)


def confirm_overwrite(path: Path) -> None:
    prompt = f"This will replace all data in {path}. Continue? [y/N] "
    reply = input(prompt).strip().lower()
    if reply not in {"y", "yes"}:
        raise SystemExit("Aborted by user.")


def main() -> int:
    args = parse_args()

    if not args.source_url:
        print("Provide --source-url or set SOURCE_DATABASE_URL / DATABASE_URL.")
        return 1

    target_path = args.target_path
    if not target_path.is_absolute():
        target_path = Path.cwd() / target_path
    target_path.parent.mkdir(parents=True, exist_ok=True)

    if not args.yes:
        confirm_overwrite(target_path)

    source_engine = create_engine(args.source_url)
    target_engine = create_engine(build_sqlite_url(target_path))

    tables = filtered_tables(args.tables)
    ensure_target_schema(target_engine)

    print(f"Syncing {len(tables)} tables from source -> {target_path}")

    disable_sqlite_foreign_keys(target_engine)
    try:
        wipe_tables(target_engine, tables)
        reports: list[SyncReport] = []
        for table in tables:
            print(f"  copying {table.name}…", end="", flush=True)
            try:
                rows = copy_table(source_engine, target_engine, table, max(1, args.chunk_size))
            except SQLAlchemyError as exc:
                print(" failed")
                print(f"    error: {exc}")
                raise
            print(f" done ({rows} rows)")
            reports.append(SyncReport(table=table.name, rows_copied=rows))
        sync_alembic_version(source_engine, target_engine)
    finally:
        enable_sqlite_foreign_keys(target_engine)
        source_engine.dispose()
        target_engine.dispose()

    total_rows = sum(r.rows_copied for r in reports)
    print("Sync complete.")
    for report in reports:
        print(f"  {report.table}: {report.rows_copied} rows")
    print(f"Total rows copied: {total_rows}")
    print("Remember to keep the source credentials secure (ideally read-only).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

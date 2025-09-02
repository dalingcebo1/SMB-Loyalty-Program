#!/usr/bin/env python3
import os
import csv
import requests
from dotenv import load_dotenv
from app.core.database import SessionLocal
from app.models import Service, Extra  # use canonical models module

def get_price_csv_url() -> str:
    load_dotenv()
    raw = os.getenv("PRICE_CSV_URL", "").strip()
    # strip out accidental `PRICE_CSV_URL=` prefix
    if raw.startswith("PRICE_CSV_URL="):
        raw = raw.split("=", 1)[1]
    if not raw:
        raise RuntimeError("Please set PRICE_CSV_URL in Backend/.env")
    return raw

def fetch_and_normalize_rows(url: str) -> tuple[list[dict], list[str]]:
    resp = requests.get(url)
    resp.raise_for_status()
    # drop empty lines
    lines = [l for l in resp.text.splitlines() if l.strip()]
    reader = csv.DictReader(lines)
    raw = list(reader)
    headers = reader.fieldnames or []
    print(f"⚙️  Fetched {len(raw)} rows; columns = {headers}")
    # lowercase & trim keys and values
    normalized = [
        {k.lower().strip(): v.strip() for k, v in row.items()}
        for row in raw
    ]
    return normalized, [h.lower().strip() for h in headers]

def upsert_from_kind(rows: list[dict]) -> tuple[int,int]:
    """
    Expects rows that each have at least:
      kind=service|extra, category, name, and either
      * base_price or price  (for service)
      * price_map           (for already-collapsed extras)
      * or price + category (for per-row extras)
    """
    svc_count = 0
    extra_count = 0
    db = SessionLocal()
    try:
        for row in rows:
            kind     = row.get("kind", "")
            name     = row.get("name", "")
            category = row.get("category", "")
            if kind == "service":
                # pull from `price` or fallback to `base_price`
                price_str   = row.get("price", row.get("base_price", "0")) or "0"
                base_price  = float(price_str)
                svc = (
                    db.query(Service)
                      .filter_by(category=category, name=name)
                      .first()
                )
                if svc:
                    svc.base_price = base_price
                else:
                    db.add(Service(category=category, name=name, base_price=base_price))
                    svc_count += 1

            elif kind == "extra":
                # build our new price_map
                if "price_map" in row:
                    new_map = row["price_map"]
                else:
                    # single-category row
                    price_str = row.get("price", "0") or "0"
                    new_map   = {category: float(price_str)}

                ex = db.query(Extra).filter_by(name=name).first()
                if ex:
                    pm = ex.price_map or {}
                    pm.update(new_map)
                    ex.price_map = pm
                else:
                    db.add(Extra(name=name, price_map=new_map))
                    extra_count += 1

        db.commit()
    finally:
        db.close()

    return svc_count, extra_count

def upsert_from_pivot(rows: list[dict], headers: list[str]) -> tuple[int,int]:
    """
    As-before: treats each row as a service, columns=categories.
    """
    svc_count  = 0
    extra_count= 0
    db = SessionLocal()
    try:
        for row in rows:
            svc_name = row.get("service", "")
            if not svc_name:
                continue
            for h in headers:
                if h in ("service","kind"):
                    continue
                price_str = row.get(h,"")
                if not price_str:
                    continue
                try:
                    price = float(price_str)
                except ValueError:
                    continue

                svc = (
                    db.query(Service)
                      .filter_by(category=h, name=svc_name)
                      .first()
                )
                if svc:
                    svc.base_price = price
                else:
                    db.add(Service(category=h, name=svc_name, base_price=price))
                    svc_count += 1

        db.commit()
    finally:
        db.close()

    return svc_count, extra_count

def drop_all_prices():
    """
    Delete all Service and Extra rows before reloading prices.
    """
    db = SessionLocal()
    try:
        db.query(Service).delete()
        db.query(Extra).delete()
        db.commit()
        print("🗑️  Dropped all existing Service and Extra records.")
    finally:
        db.close()

def main():
    url = get_price_csv_url()
    print(f"▶️  Fetching price list from: {url!r}")
    rows, headers = fetch_and_normalize_rows(url)

    if not rows:
        print("⚠️  No rows found – check your PRICE_CSV_URL")
        return

    # Drop all existing prices before upserting new ones
    drop_all_prices()

    hdrs = set(headers)
    # -- If it's the kind-based sheet, collapse extras by name first --
    if "kind" in hdrs:
        # split services vs extras
        services = [r for r in rows if r.get("kind") == "service"]
        extras   = [r for r in rows if r.get("kind") == "extra"]

        # collapse extras: one entry per unique name, merge all categories
        merged = {}
        for e in extras:
            nm   = e["name"]
            cat  = e["category"]
            price= float(e.get("price","0") or 0)
            merged.setdefault(nm, {})[cat] = price

        # rebuild rows: all services + one row per merged extra
        rows = services + [
            {"kind":"extra", "name": nm, "price_map": pm}
            for nm, pm in merged.items()
        ]

        svc_count, extra_count = upsert_from_kind(rows)

    # -- pivot format --
    elif "service" in hdrs and len(headers) > 2:
        svc_count, extra_count = upsert_from_pivot(rows, headers)

    else:
        raise RuntimeError(f"Unrecognized CSV format. Headers: {headers!r}")

    print(f"✅ Loaded {svc_count} services, {extra_count} extras")


if __name__ == "__main__":
    main()

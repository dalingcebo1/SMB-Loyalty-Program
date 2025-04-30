#!/usr/bin/env python3
import os
import csv
import requests
from dotenv import load_dotenv
from database import SessionLocal
from models import Service, Extra

def get_price_csv_url() -> str:
    load_dotenv()
    raw = os.getenv("PRICE_CSV_URL", "").strip()
    if raw.startswith("PRICE_CSV_URL="):
        raw = raw.split("=", 1)[1]
    if not raw:
        raise RuntimeError("Please set PRICE_CSV_URL in Backend/.env")
    return raw

def fetch_and_normalize_rows(url: str) -> tuple[list[dict], list[str]]:
    resp = requests.get(url)
    resp.raise_for_status()
    lines = [l for l in resp.text.splitlines() if l.strip()]
    reader = csv.DictReader(lines)
    raw_rows = list(reader)
    headers = reader.fieldnames or []
    print(f"⚙️  Fetched {len(raw_rows)} rows; columns = {headers}")

    # normalize keys to lowercase and trim whitespace
    normalized = [
        {k.lower().strip(): v.strip() for k, v in row.items()}
        for row in raw_rows
    ]
    return normalized, [h.lower().strip() for h in headers]

def upsert_from_kind(rows: list[dict]) -> tuple[int,int]:
    svc_count = 0
    extra_count = 0
    db = SessionLocal()
    try:
        for row in rows:
            kind     = row.get("kind", "")
            category = row.get("category", "")
            name     = row.get("name", "")

            if kind == "service":
                # use the new `price` column (fallback to base_price if present)
                price_str = row.get("price", row.get("base_price", "0")) or "0"
                base_price = float(price_str)
                obj = db.query(Service).filter_by(category=category, name=name).first()
                if obj:
                    obj.base_price = base_price
                else:
                    db.add(Service(category=category, name=name, base_price=base_price))
                    svc_count += 1

            elif kind == "extra":
                # build a simple map of { category: price }
                price_str = row.get("price", "0") or "0"
                price = float(price_str)
                obj = db.query(Extra).filter_by(name=name).first()
                if obj:
                    pm = obj.price_map or {}
                    pm.update({category: price})
                    obj.price_map = pm
                else:
                    db.add(Extra(name=name, price_map={category: price}))
                    extra_count += 1

        db.commit()
    finally:
        db.close()
    return svc_count, extra_count

def upsert_from_pivot(rows: list[dict], headers: list[str]) -> tuple[int,int]:
    svc_count = 0
    extra_count = 0
    db = SessionLocal()
    try:
        for row in rows:
            service_name = row.get("service", "")
            if not service_name:
                continue
            for h in headers:
                if h in ("service", "kind"):
                    continue
                price_str = row.get(h, "")
                if not price_str:
                    continue
                try:
                    price = float(price_str)
                except ValueError:
                    continue
                obj = db.query(Service).filter_by(category=h, name=service_name).first()
                if obj:
                    obj.base_price = price
                else:
                    db.add(Service(category=h, name=service_name, base_price=price))
                    svc_count += 1
        db.commit()
    finally:
        db.close()
    return svc_count, extra_count

def main():
    url = get_price_csv_url()
    print(f"▶️  Fetching price list from: {url}")
    rows, headers = fetch_and_normalize_rows(url)

    if not rows:
        print("⚠️  No rows found in CSV – check your PRICE_CSV_URL")
        return

    hdrs = set(headers)
    if "kind" in hdrs:
        s, e = upsert_from_kind(rows)
    elif "service" in hdrs and len(headers) > 2:
        s, e = upsert_from_pivot(rows, headers)
    else:
        raise RuntimeError(f"Unrecognized CSV format. Headers: {headers!r}")

    print(f"✅ Loaded {s} services, {e} extras")

if __name__ == "__main__":
    main()

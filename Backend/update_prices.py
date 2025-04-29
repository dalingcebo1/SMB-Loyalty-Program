#!/usr/bin/env python3
import os
import csv
import requests

from database import SessionLocal, engine, Base
from models import Service, Extra

# 1) Point this at your published‐CSV URL
CSV_URL = os.getenv(
    "PRICE_CSV_URL",
    "https://docs.google.com/spreadsheets/d/"
    "1cYmRjU6vGLiE925nFhTOTvVpZZhoiFmVtM9WigYqe3g"
    "/export?format=csv&gid=0"
)

def fetch_rows(url: str):
    resp = requests.get(url)
    resp.raise_for_status()
    return list(csv.DictReader(resp.text.splitlines()))

def main():
    print("🔄 Fetching price list from Google Sheets…")
    rows = fetch_rows(CSV_URL)

    # Ensure our tables exist
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Clear old data
        db.query(Service).delete()
        db.query(Extra).delete()
        db.commit()

        # Upsert from CSV
        for r in rows:
            name = r.get("Item") or r.get("Service") or r.get("Wash") or ""
            kind = r.get("Type", "").strip().lower()
            if not name or kind not in ("service", "extra"):
                continue

            # Build per‐category price map
            price_map = {
                "car/bike":   int(r.get("Car / Bike", 0) or 0),
                "suv/4x4":    int(r.get("SUV 4X4", 0) or 0),
                "minibus":    int(r.get("Mini Bus", 0) or 0),
            }

            if kind == "service":
                # One row per category
                for cat, price in price_map.items():
                    svc = Service(category=cat, name=name, base_price=price)
                    db.add(svc)
            else:  # kind == "extra"
                ex = Extra(name=name, price_map=price_map)
                db.add(ex)

        db.commit()
        print("✅ Prices updated successfully.")
    finally:
        db.close()

if __name__ == "__main__":
    main()

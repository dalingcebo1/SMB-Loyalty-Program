#!/usr/bin/env python3
"""
Seed script for car wash services.
This script populates the services table with various car wash service offerings.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import sessionmaker
from models import Service, Extra
from database import engine

# Create a session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def seed_services():
    """Seed the database with car wash services."""
    db = SessionLocal()
    
    try:
        # Check if services already exist
        existing_services = db.query(Service).count()
        if existing_services > 0:
            print(f"Services already exist ({existing_services} services found). Skipping seed.")
            return
        
        # Car wash services
        services = [
            # Premium Services
            {
                "category": "Premium",
                "name": "Premium Full House Wash",
                "base_price": 12000,  # R120.00 in cents
                "loyalty_eligible": True
            },
            {
                "category": "Premium", 
                "name": "Premium Exterior & Interior",
                "base_price": 10000,  # R100.00
                "loyalty_eligible": True
            },
            {
                "category": "Premium",
                "name": "Premium Wash & Wax",
                "base_price": 8000,   # R80.00
                "loyalty_eligible": True
            },
            
            # Standard Services
            {
                "category": "Standard",
                "name": "Full House Wash",
                "base_price": 8000,   # R80.00
                "loyalty_eligible": True
            },
            {
                "category": "Standard",
                "name": "Exterior & Interior Clean",
                "base_price": 6000,   # R60.00
                "loyalty_eligible": True
            },
            {
                "category": "Standard",
                "name": "Exterior Wash Only",
                "base_price": 4000,   # R40.00
                "loyalty_eligible": True
            },
            {
                "category": "Standard",
                "name": "Interior Clean Only",
                "base_price": 3500,   # R35.00
                "loyalty_eligible": True
            },
            
            # Express Services
            {
                "category": "Express",
                "name": "Express Wash",
                "base_price": 2500,   # R25.00
                "loyalty_eligible": True
            },
            {
                "category": "Express",
                "name": "Quick Rinse",
                "base_price": 1500,   # R15.00
                "loyalty_eligible": True
            },
            
            # Specialty Services
            {
                "category": "Specialty",
                "name": "Engine Bay Clean",
                "base_price": 5000,   # R50.00
                "loyalty_eligible": True
            },
            {
                "category": "Specialty",
                "name": "Wheel & Rim Detail",
                "base_price": 3000,   # R30.00
                "loyalty_eligible": True
            },
            {
                "category": "Specialty",
                "name": "Headlight Restoration",
                "base_price": 4500,   # R45.00
                "loyalty_eligible": True
            }
        ]
        
        # Add services to database
        for service_data in services:
            service = Service(**service_data)
            db.add(service)
        
        # Commit services
        db.commit()
        print(f"Successfully seeded {len(services)} services!")
        
        # Seed extras/add-ons
        extras = [
            {
                "name": "Car Freshener",
                "price_map": {
                    "Premium": 500,   # R5.00
                    "Standard": 500,
                    "Express": 500,
                    "Specialty": 500
                }
            },
            {
                "name": "Tire Shine",
                "price_map": {
                    "Premium": 1000,  # R10.00
                    "Standard": 1000,
                    "Express": 1500,  # More expensive for express
                    "Specialty": 1000
                }
            },
            {
                "name": "Dashboard Polish",
                "price_map": {
                    "Premium": 800,   # R8.00
                    "Standard": 1000,
                    "Express": 1500,
                    "Specialty": 800
                }
            },
            {
                "name": "Floor Mat Deep Clean",
                "price_map": {
                    "Premium": 1200,  # R12.00
                    "Standard": 1500,
                    "Express": 2000,
                    "Specialty": 1200
                }
            },
            {
                "name": "Window Treatment",
                "price_map": {
                    "Premium": 1500,  # R15.00
                    "Standard": 2000,
                    "Express": 2500,
                    "Specialty": 1500
                }
            }
        ]
        
        # Add extras to database
        for extra_data in extras:
            extra = Extra(**extra_data)
            db.add(extra)
        
        db.commit()
        print(f"Successfully seeded {len(extras)} extras!")
        
        # Display seeded data
        print("\n=== SEEDED SERVICES ===")
        for service in db.query(Service).all():
            price_display = f"R{service.base_price/100:.2f}"
            print(f"  [{service.category}] {service.name} - {price_display}")
        
        print("\n=== SEEDED EXTRAS ===")
        for extra in db.query(Extra).all():
            print(f"  {extra.name}")
            for category, price in extra.price_map.items():
                print(f"    {category}: R{price/100:.2f}")
        
    except Exception as e:
        print(f"Error seeding services: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    print("Seeding car wash services...")
    seed_services()
    print("Seeding complete!")

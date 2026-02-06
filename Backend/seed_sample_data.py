#!/usr/bin/env python3
"""Seed sample orders, vehicles, and transactions for local testing.

Mimics realistic test environment data.
"""
import os
import sys
from datetime import datetime, timedelta
import random

HERE = os.path.dirname(__file__)
ROOT = os.path.abspath(os.path.join(HERE, ".."))
sys.path.insert(0, ROOT)

from app.core.database import SessionLocal
from app.models import (
    User, Vehicle, Order, Payment, VisitCount, 
    Service, Extra, OrderItem, Tenant
)

def seed_sample_data():
    """Create realistic sample data for local testing."""
    with SessionLocal() as session:
        # Get users
        admin = session.query(User).filter_by(email="dali.ngubane@chaosx.co.za").first()
        test_user = session.query(User).filter_by(email="smblptest@gmail.com").first()
        
        if not admin or not test_user:
            print("❌ Users not found. Run seed_users.py first.")
            return
        
        # Get services
        services = session.query(Service).all()
        if not services:
            print("❌ Services not found. Run seed_services.py first.")
            return
        
        # Create vehicles for test users
        vehicles_data = [
            {"user": admin, "plate": "ABC123GP", "make": "Toyota", "model": "Corolla"},
            {"user": admin, "plate": "XYZ789GP", "make": "BMW", "model": "3 Series"},
            {"user": test_user, "plate": "TEST001GP", "make": "Honda", "model": "Civic"},
            {"user": test_user, "plate": "DEV456GP", "make": "Mercedes", "model": "C-Class"},
        ]
        
        created_vehicles = []
        for vdata in vehicles_data:
            existing = session.query(Vehicle).filter_by(plate=vdata["plate"]).first()
            if not existing:
                vehicle = Vehicle(**vdata)
                session.add(vehicle)
                created_vehicles.append(vehicle)
        
        session.commit()
        print(f"✓ Created {len(created_vehicles)} vehicles")
        
        # Create sample orders with payments
        orders_created = 0
        payments_created = 0
        
        for i in range(10):  # Create 10 sample orders
            user = random.choice([admin, test_user])
            service = random.choice(services)
            
            # Create order
            order = Order(
                service_id=service.id,
                quantity=1,
                extras=[],
                payment_pin=f"{1000 + i:04d}",
                status=random.choice(["paid", "completed"]),
                user_id=user.id,
                tenant_id="default",
                created_at=datetime.utcnow() - timedelta(days=random.randint(0, 30)),
                redeemed=False,
                type="wash",
                amount=service.base_price
            )
            session.add(order)
            session.flush()  # Get order ID
            
            # Create payment for paid/completed orders
            if order.status in ["paid", "completed"]:
                payment = Payment(
                    order_id=order.id,
                    amount=service.base_price,
                    method="yoco",
                    transaction_id=f"ch_test_{order.id}_{i}",
                    reference=f"ref_{order.id}_{i}",
                    status="success",
                    created_at=order.created_at,
                    card_brand="VISA",
                    source="yoco"
                )
                session.add(payment)
                payments_created += 1
            
            orders_created += 1
        
        # Create visit counts
        for user in [admin, test_user]:
            existing_vc = session.query(VisitCount).filter_by(
                user_id=user.id, 
                tenant_id="default"
            ).first()
            
            if not existing_vc:
                vc = VisitCount(
                    user_id=user.id,
                    tenant_id="default",
                    count=random.randint(5, 20),
                    updated_at=datetime.utcnow()
                )
                session.add(vc)
        
        session.commit()
        
        print(f"✓ Created {orders_created} orders")
        print(f"✓ Created {payments_created} payments")
        print("✓ Updated visit counts")
        
        # Summary
        print("\n=== Database Summary ===")
        print(f"Tenants:  {session.query(Tenant).count()}")
        print(f"Users:    {session.query(User).count()}")
        print(f"Services: {session.query(Service).count()}")
        print(f"Vehicles: {session.query(Vehicle).count()}")
        print(f"Orders:   {session.query(Order).count()}")
        print(f"Payments: {session.query(Payment).count()}")
        print("\n✅ Sample data seeding complete!")

if __name__ == "__main__":
    seed_sample_data()

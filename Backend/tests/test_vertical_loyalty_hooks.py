from app.core.database import SessionLocal, Base, engine
from app.models import Tenant, User, Order, Payment
from datetime import datetime
from app.plugins.verticals.vertical_dispatch import dispatch
from app.core.plugin_manager import PluginManager
from fastapi import FastAPI

def test_compute_loyalty_variants():
    # Ensure tables exist (SQLite test env may not run migrations automatically)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    # ensure vertical plugin hooks registered (instantiate minimal app + plugin manager)
    PluginManager(FastAPI()).register_routes()
    # create tenants for two verticals
    car = db.query(Tenant).filter_by(id='vhcar').first() or Tenant(id='vhcar', name='VH Car', loyalty_type='standard', vertical_type='carwash', created_at=datetime.utcnow())
    flower = db.query(Tenant).filter_by(id='vhflw').first() or Tenant(id='vhflw', name='VH Flower', loyalty_type='standard', vertical_type='flowershop', created_at=datetime.utcnow())
    db.merge(car); db.merge(flower); db.commit()
    ucar = db.query(User).filter_by(email='vhcar@example.com').first() or User(email='vhcar@example.com', phone='1', tenant_id='vhcar', role='user')
    uflw = db.query(User).filter_by(email='vhflw@example.com').first() or User(email='vhflw@example.com', phone='2', tenant_id='vhflw', role='user')
    db.add(ucar); db.add(uflw); db.commit(); db.refresh(ucar); db.refresh(uflw)
    # fabricate orders (not persisted loyalty logic only uses amount & vertical_type)
    ocar = Order(id=9991, amount=10000, extras=[], service_id=None, quantity=1, user_id=ucar.id, created_at=datetime.utcnow())
    oflw = Order(id=9992, amount=10000, extras=[], service_id=None, quantity=1, user_id=uflw.id, created_at=datetime.utcnow())
    # attach vertical_type (transient) for hooks
    ocar.vertical_type = 'carwash'
    oflw.vertical_type = 'flowershop'
    p1 = dispatch('compute_loyalty_earn', ocar)
    p2 = dispatch('compute_loyalty_earn', oflw)
    # Baseline default would be amount//100 = 100
    # Carwash specialization divides by 80 -> 125
    # Flowershop specialization divides by 120 -> 83 (floor)
    assert p1 == 125, p1
    assert p2 == 83, p2
    db.close()

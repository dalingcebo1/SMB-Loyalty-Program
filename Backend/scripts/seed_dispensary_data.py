"""
Seed Data for Dispensary Vertical

Creates sample categories and products for testing the dispensary feature.
Run with: python -m scripts.seed_dispensary_data [tenant_id]
"""
import sys
import os
from datetime import date, timedelta

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models import (
    Tenant,
    DispensaryProductCategory,
    DispensaryProduct,
)


def seed_categories(db: Session, tenant_id: str) -> dict:
    """Create standard dispensary product categories."""
    categories_data = [
        {
            "name": "Flower",
            "description": "Premium cannabis flower products",
            "icon": "🌸",
            "display_order": 1,
            "requires_medical_card": False,
        },
        {
            "name": "Pre-Rolls",
            "description": "Ready-to-smoke pre-rolled joints",
            "icon": "🚬",
            "display_order": 2,
            "requires_medical_card": False,
        },
        {
            "name": "Edibles",
            "description": "Cannabis-infused edible products",
            "icon": "🍪",
            "display_order": 3,
            "requires_medical_card": False,
        },
        {
            "name": "Concentrates",
            "description": "High-potency cannabis concentrates",
            "icon": "💎",
            "display_order": 4,
            "requires_medical_card": False,
        },
        {
            "name": "Vapes",
            "description": "Cannabis vape cartridges and pens",
            "icon": "💨",
            "display_order": 5,
            "requires_medical_card": False,
        },
        {
            "name": "Topicals",
            "description": "Cannabis-infused lotions and balms",
            "icon": "🧴",
            "display_order": 6,
            "requires_medical_card": False,
        },
        {
            "name": "Medical Cannabis",
            "description": "Products requiring medical card",
            "icon": "⚕️",
            "display_order": 7,
            "requires_medical_card": True,
        },
        {
            "name": "Accessories",
            "description": "Smoking and storage accessories",
            "icon": "🛠️",
            "display_order": 8,
            "requires_medical_card": False,
        },
    ]
    
    categories = {}
    for cat_data in categories_data:
        category = DispensaryProductCategory(
            tenant_id=tenant_id,
            **cat_data,
            active=True
        )
        db.add(category)
        db.flush()
        categories[cat_data["name"]] = category
        print(f"✓ Created category: {cat_data['name']}")
    
    db.commit()
    return categories


def seed_products(db: Session, tenant_id: str, categories: dict):
    """Create sample cannabis products."""
    today = date.today()
    
    products_data = [
        # Flower products
        {
            "category": "Flower",
            "name": "Blue Dream",
            "strain": "Blue Dream",
            "strain_type": "hybrid",
            "description": "Popular hybrid strain with balanced effects and sweet berry aroma",
            "sku": "BD-3.5G",
            "thc_percentage": 22.5,
            "cbd_percentage": 0.8,
            "terpenes": "Myrcene, Pinene, Caryophyllene",
            "effects": "Relaxed, Happy, Euphoric, Creative",
            "medical_uses": "Stress, Pain, Depression, Fatigue",
            "price_cents": 15000,  # R150
            "unit_size": "3.5g",
            "stock_quantity": 50,
            "batch_number": "BD220125",
            "harvest_date": today - timedelta(days=60),
            "package_date": today - timedelta(days=45),
            "potency_level": "high",
            "featured": True,
        },
        {
            "category": "Flower",
            "name": "OG Kush",
            "strain": "OG Kush",
            "strain_type": "indica",
            "description": "Classic indica with earthy pine flavors and heavy relaxation",
            "sku": "OGK-3.5G",
            "thc_percentage": 24.0,
            "cbd_percentage": 0.5,
            "terpenes": "Limonene, Myrcene, Pinene",
            "effects": "Relaxed, Sleepy, Happy, Hungry",
            "medical_uses": "Insomnia, Pain, Stress, Appetite Loss",
            "price_cents": 18000,  # R180
            "unit_size": "3.5g",
            "stock_quantity": 35,
            "batch_number": "OGK220126",
            "harvest_date": today - timedelta(days=50),
            "package_date": today - timedelta(days=35),
            "potency_level": "very_high",
            "featured": True,
        },
        {
            "category": "Flower",
            "name": "Sour Diesel",
            "strain": "Sour Diesel",
            "strain_type": "sativa",
            "description": "Energizing sativa with diesel and citrus notes",
            "sku": "SD-3.5G",
            "thc_percentage": 21.0,
            "cbd_percentage": 0.3,
            "terpenes": "Caryophyllene, Limonene, Myrcene",
            "effects": "Energetic, Focused, Uplifted, Creative",
            "medical_uses": "Depression, Fatigue, Stress",
            "price_cents": 16000,  # R160
            "unit_size": "3.5g",
            "stock_quantity": 40,
            "batch_number": "SD220127",
            "harvest_date": today - timedelta(days=55),
            "package_date": today - timedelta(days=40),
            "potency_level": "high",
            "featured": False,
        },
        
        # Pre-Rolls
        {
            "category": "Pre-Rolls",
            "name": "Blue Dream Pre-Roll Pack",
            "strain": "Blue Dream",
            "strain_type": "hybrid",
            "description": "Pack of 5 perfectly rolled 0.5g joints",
            "sku": "BD-PR5",
            "thc_percentage": 22.0,
            "cbd_percentage": 0.8,
            "price_cents": 12000,  # R120
            "unit_size": "5x0.5g",
            "stock_quantity": 60,
            "batch_number": "BD-PR220125",
            "package_date": today - timedelta(days=30),
            "potency_level": "high",
            "featured": True,
        },
        
        # Edibles
        {
            "category": "Edibles",
            "name": "Mixed Berry Gummies",
            "description": "10mg THC per gummy, 10 pieces per pack",
            "sku": "GUMMY-BERRY",
            "thc_percentage": None,  # Specified per dose
            "cbd_percentage": None,
            "effects": "Relaxed, Happy, Euphoric",
            "medical_uses": "Pain, Anxiety, Sleep",
            "price_cents": 25000,  # R250
            "unit_size": "100mg THC (10x10mg)",
            "stock_quantity": 80,
            "batch_number": "GUMMY220128",
            "package_date": today - timedelta(days=20),
            "expiry_date": today + timedelta(days=365),
            "potency_level": "medium",
            "featured": True,
        },
        {
            "category": "Edibles",
            "name": "Dark Chocolate Bar",
            "description": "Premium dark chocolate infused with 100mg THC",
            "sku": "CHOC-DARK",
            "thc_percentage": None,
            "cbd_percentage": None,
            "effects": "Relaxed, Happy, Euphoric",
            "medical_uses": "Pain, Stress, Insomnia",
            "price_cents": 20000,  # R200
            "unit_size": "100mg THC",
            "stock_quantity": 45,
            "batch_number": "CHOC220129",
            "package_date": today - timedelta(days=15),
            "expiry_date": today + timedelta(days=180),
            "potency_level": "high",
            "featured": False,
        },
        
        # Concentrates
        {
            "category": "Concentrates",
            "name": "Live Resin - Blue Dream",
            "strain": "Blue Dream",
            "strain_type": "hybrid",
            "description": "Premium live resin extract with full terpene profile",
            "sku": "LR-BD-1G",
            "thc_percentage": 85.0,
            "cbd_percentage": 1.2,
            "terpenes": "Myrcene, Pinene, Caryophyllene, Limonene",
            "effects": "Intense, Euphoric, Relaxed",
            "price_cents": 45000,  # R450
            "unit_size": "1g",
            "stock_quantity": 20,
            "batch_number": "LR-BD220130",
            "harvest_date": today - timedelta(days=40),
            "package_date": today - timedelta(days=25),
            "potency_level": "very_high",
            "featured": True,
        },
        
        # Vapes
        {
            "category": "Vapes",
            "name": "Vape Cartridge - Sour Diesel",
            "strain": "Sour Diesel",
            "strain_type": "sativa",
            "description": "510 thread cartridge with pure distillate",
            "sku": "VAPE-SD-1G",
            "thc_percentage": 88.0,
            "cbd_percentage": 0.5,
            "effects": "Energetic, Focused, Uplifted",
            "price_cents": 35000,  # R350
            "unit_size": "1g",
            "stock_quantity": 55,
            "batch_number": "VAPE-SD220131",
            "package_date": today - timedelta(days=10),
            "potency_level": "very_high",
            "featured": True,
        },
        
        # Topicals
        {
            "category": "Topicals",
            "name": "Pain Relief Balm",
            "description": "CBD-rich topical balm for localized pain relief",
            "sku": "BALM-CBD",
            "thc_percentage": 2.0,
            "cbd_percentage": 25.0,
            "medical_uses": "Pain, Inflammation, Muscle soreness",
            "price_cents": 30000,  # R300
            "unit_size": "100ml",
            "stock_quantity": 40,
            "batch_number": "BALM220201",
            "package_date": today - timedelta(days=5),
            "expiry_date": today + timedelta(days=730),
            "potency_level": "high",
            "featured": False,
        },
        
        # Accessories
        {
            "category": "Accessories",
            "name": "Glass Pipe - Small",
            "description": "Hand-blown glass pipe, assorted colors",
            "sku": "PIPE-SM",
            "price_cents": 8000,  # R80
            "unit_size": "1 piece",
            "stock_quantity": 100,
            "featured": False,
        },
        {
            "category": "Accessories",
            "name": "Smell-Proof Storage Jar",
            "description": "Airtight glass jar with humidity control",
            "sku": "JAR-LARGE",
            "price_cents": 15000,  # R150
            "unit_size": "500ml",
            "stock_quantity": 75,
            "featured": False,
        },
    ]
    
    for prod_data in products_data:
        category_name = prod_data.pop("category")
        category = categories.get(category_name)
        
        if not category:
            print(f"✗ Category '{category_name}' not found, skipping product")
            continue
        
        product = DispensaryProduct(
            tenant_id=tenant_id,
            category_id=category.id,
            **prod_data,
            requires_medical_card=False,
            active=True
        )
        db.add(product)
        print(f"✓ Created product: {prod_data['name']}")
    
    db.commit()


def main():
    """Main seeding function."""
    if len(sys.argv) < 2:
        print("Usage: python -m scripts.seed_dispensary_data <tenant_id>")
        print("\nExample: python -m scripts.seed_dispensary_data tenant-001")
        sys.exit(1)
    
    tenant_id = sys.argv[1]
    
    db = SessionLocal()
    try:
        # Verify tenant exists
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            print(f"✗ Tenant '{tenant_id}' not found")
            sys.exit(1)
        
        print(f"\n🌿 Seeding dispensary data for tenant: {tenant_id}\n")
        
        # Check if vertical type is dispensary
        if tenant.vertical_type != "dispensary":
            print(f"⚠️  Warning: Tenant vertical type is '{tenant.vertical_type}', not 'dispensary'")
            response = input("Continue anyway? (y/N): ")
            if response.lower() != 'y':
                print("Aborted.")
                sys.exit(0)
        
        # Seed categories
        print("\n📁 Creating product categories...")
        categories = seed_categories(db, tenant_id)
        
        # Seed products
        print("\n📦 Creating sample products...")
        seed_products(db, tenant_id, categories)
        
        print("\n✅ Dispensary data seeded successfully!")
        print(f"\nCreated:")
        print(f"  - {len(categories)} product categories")
        print(f"  - Multiple products across all categories")
        print(f"\nYou can now test the dispensary feature at:")
        print(f"  - Customer catalog: /dispensary")
        print(f"  - Admin products: /admin/dispensary/products")
        print(f"  - Admin categories: /admin/dispensary/categories")
        
    except Exception as e:
        db.rollback()
        print(f"\n✗ Error seeding data: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()

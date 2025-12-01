"""
Tests for Vertical Module System
"""

import pytest
from app.verticals import registry, VerticalModule
from app.verticals.carwash import CarwashVertical
from app.verticals.dispensary import DispensaryVertical


def test_vertical_registry_initialization():
    """Test that registry initializes correctly."""
    assert registry is not None
    assert len(registry.list_all()) >= 0


def test_carwash_vertical_properties():
    """Test carwash vertical basic properties."""
    carwash = CarwashVertical()
    
    assert carwash.vertical_key == "carwash"
    assert carwash.display_name == "Car Wash & Detailing"
    assert "vehicle_tracking" in carwash.get_features()
    assert "wash_packages" in carwash.get_features()
    assert carwash.requires_compliance is False


def test_dispensary_vertical_properties():
    """Test dispensary vertical basic properties."""
    dispensary = DispensaryVertical()
    
    assert dispensary.vertical_key == "dispensary"
    assert dispensary.display_name == "Cannabis Dispensary"
    assert "age_verification" in dispensary.get_features()
    assert "compliance_tracking" in dispensary.get_features()
    assert dispensary.requires_compliance is True


def test_vertical_default_config():
    """Test that verticals provide default configuration."""
    carwash = CarwashVertical()
    config = carwash.get_default_config()
    
    assert "features" in config
    assert "settings" in config
    assert "branding" in config
    assert config["features"]["vehicle_tracking"] is True


def test_vertical_capabilities():
    """Test that verticals define capabilities."""
    carwash = CarwashVertical()
    
    admin_caps = carwash.get_admin_capabilities()
    staff_caps = carwash.get_staff_capabilities()
    
    assert len(admin_caps) > 0
    assert len(staff_caps) > 0
    assert "carwash.manage_bays" in admin_caps
    assert "carwash.process_orders" in staff_caps


def test_dispensary_config_validation():
    """Test dispensary configuration validation."""
    dispensary = DispensaryVertical()
    
    # Valid config
    valid_config = {
        "features": {
            "age_verification": True,
            "compliance_tracking": True,
        },
        "settings": {
            "minimum_age": 21
        }
    }
    result = dispensary.validate_config(valid_config)
    assert result == valid_config
    
    # Invalid config - missing age verification
    invalid_config = {
        "features": {
            "age_verification": False,
            "compliance_tracking": True,
        }
    }
    with pytest.raises(ValueError, match="Age verification must be enabled"):
        dispensary.validate_config(invalid_config)


def test_carwash_config_validation():
    """Test carwash configuration validation."""
    carwash = CarwashVertical()
    
    # Valid config
    valid_config = {
        "settings": {
            "default_loyalty_multiplier": 2.0
        }
    }
    result = carwash.validate_config(valid_config)
    assert result == valid_config
    
    # Invalid config - loyalty multiplier out of range
    invalid_config = {
        "settings": {
            "default_loyalty_multiplier": 10.0
        }
    }
    with pytest.raises(ValueError, match="Loyalty multiplier must be between"):
        carwash.validate_config(invalid_config)


def test_registry_auto_registration():
    """Test that registry can auto-register verticals."""
    # Clear and re-register
    test_registry = registry.__class__()
    test_registry.auto_register_all()
    
    # Should have at least the 5 main verticals
    all_verticals = test_registry.list_all()
    assert len(all_verticals) >= 5
    
    vertical_keys = [v.vertical_key for v in all_verticals]
    assert "carwash" in vertical_keys
    assert "dispensary" in vertical_keys
    assert "padel" in vertical_keys
    assert "flowershop" in vertical_keys
    assert "beauty" in vertical_keys


def test_registry_get_vertical():
    """Test retrieving specific vertical from registry."""
    test_registry = registry.__class__()
    test_registry.register(CarwashVertical())
    
    carwash = test_registry.get("carwash")
    assert carwash is not None
    assert carwash.vertical_key == "carwash"
    
    # Non-existent vertical
    missing = test_registry.get("nonexistent")
    assert missing is None


def test_registry_feature_search():
    """Test searching verticals by feature."""
    test_registry = registry.__class__()
    test_registry.register(CarwashVertical())
    test_registry.register(DispensaryVertical())
    
    # Search for loyalty_rewards feature
    verticals_with_loyalty = test_registry.get_by_features("loyalty_rewards")
    vertical_keys = [v.vertical_key for v in verticals_with_loyalty]
    
    # Both should have loyalty rewards
    assert "carwash" in vertical_keys
    assert "dispensary" in vertical_keys


def test_vertical_metadata_decoration():
    """Test that verticals can decorate tenant metadata."""
    carwash = CarwashVertical()
    
    # Mock tenant
    class MockTenant:
        vertical_type = "carwash"
    
    meta = {
        "tenant_id": "test-tenant",
        "features": {},
    }
    
    carwash.decorate_tenant_meta(meta, MockTenant())
    
    # Should have added carwash-specific data
    assert "carwash" in meta
    assert "features_enabled" in meta["carwash"]

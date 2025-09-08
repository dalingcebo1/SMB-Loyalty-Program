#!/usr/bin/env python3
"""
Quick integration test for launch features.
"""
import sys
import os

# Change to Backend directory to match expected static path
os.chdir('/workspaces/SMB-Loyalty-Program/Backend')
sys.path.append('/workspaces/SMB-Loyalty-Program/Backend')

def test_imports():
    """Test that all new modules import correctly."""
    print("🔍 Testing imports...")
    
    try:
        from app.services.subscription_billing import billing_service
        print("✅ Subscription billing service imported")
    except Exception as e:
        print(f"❌ Subscription billing service failed: {e}")
        return False
    
    try:
        from app.services.business_onboarding import onboarding_service
        print("✅ Business onboarding service imported")
    except Exception as e:
        print(f"❌ Business onboarding service failed: {e}")
        return False
    
    try:
        from app.routes.health import router as health_router
        print("✅ Health routes imported")
    except Exception as e:
        print(f"❌ Health routes failed: {e}")
        return False
    
    try:
        from app.routes.onboarding import router as onboarding_router
        print("✅ Onboarding routes imported")
    except Exception as e:
        print(f"❌ Onboarding routes failed: {e}")
        return False
    
    return True

def test_main_app():
    """Test that the main FastAPI app loads with new routes."""
    print("\n🚀 Testing FastAPI app...")
    
    try:
        from main import app
        print("✅ Main FastAPI app loaded")
        
        # Check routes are registered
        routes = [route.path for route in app.routes]
        
        expected_routes = [
            '/health/',
            '/health/detailed', 
            '/health/ready',
            '/health/live',
            '/health/metrics'
        ]
        
        for route in expected_routes:
            if any(r for r in routes if route in r):
                print(f"✅ Health route found: {route}")
            else:
                print(f"❌ Health route missing: {route}")
                return False
        
        return True
    except Exception as e:
        print(f"❌ FastAPI app failed: {e}")
        return False

def test_health_check():
    """Test basic health check functionality."""
    print("\n💓 Testing health check...")
    
    try:
        from app.routes.health import health_check
        import asyncio
        
        async def run_test():
            result = await health_check()
            return result
        
        result = asyncio.run(run_test())
        
        if result.get('status') == 'healthy':
            print("✅ Basic health check working")
            return True
        else:
            print(f"❌ Health check failed: {result}")
            return False
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return False

def main():
    """Run all tests."""
    print("🧪 Launch Features Integration Test")
    print("=" * 40)
    
    tests = [
        test_imports,
        test_main_app,
        test_health_check
    ]
    
    passed = 0
    for test in tests:
        if test():
            passed += 1
        else:
            break
    
    print("\n" + "=" * 40)
    print(f"📊 Results: {passed}/{len(tests)} tests passed")
    
    if passed == len(tests):
        print("🎉 All integration tests PASSED!")
        print("🚀 Launch features are ready for production!")
        return True
    else:
        print("❌ Some tests FAILED!")
        print("🔧 Please fix the issues before launching.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

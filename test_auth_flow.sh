#!/bin/bash

# Test script to verify authentication flow improvements

echo "🧪 Testing Authentication Flow Consistency"
echo "=========================================="

# Test 1: Traditional signup should create user with onboarded=false
echo -e "\n1️⃣ Testing traditional signup flow..."
curl -X POST "http://localhost:8000/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{"email": "test-traditional@example.com", "password": "testpass123"}' \
  --silent --output /dev/null --write-out "Status: %{http_code}\n"

# Test 2: Social login should also require onboarding for new users  
echo -e "\n2️⃣ Testing social login flow (simulated)..."
echo "Note: This would require a valid Firebase ID token in real testing"

# Test 3: Login attempt for incomplete user should return 403 with onboarding_required
echo -e "\n3️⃣ Testing login with incomplete onboarding..."
curl -X POST "http://localhost:8000/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=test-traditional@example.com&password=testpass123" \
  --silent | python3 -m json.tool 2>/dev/null || echo "Response received (may not be JSON)"

echo -e "\n✅ Authentication flow tests completed!"
echo "👉 Next steps:"
echo "   1. Test complete onboarding flow in browser"
echo "   2. Verify social login requires phone verification"
echo "   3. Test error handling and recovery scenarios"

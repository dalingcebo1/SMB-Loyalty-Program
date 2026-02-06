#!/bin/bash
# Quick full reset and seed script for local development
# Usage: ./reset_local_dev.sh

set -e  # Exit on error

echo "🔄 Resetting Local Development Environment..."
echo ""

# Check if we're in the right directory
if [ ! -f "Backend/seed_all.py" ]; then
    echo "❌ Error: Must run from project root"
    exit 1
fi

# Ensure Docker container is running
echo "1️⃣  Starting PostgreSQL container..."
docker-compose -f docker-compose.local-db.yml up -d
sleep 3

# Wait for PostgreSQL to be ready
echo "2️⃣  Waiting for database to be ready..."
until docker exec loyalty_local_db pg_isready -U postgres > /dev/null 2>&1; do
    echo "   ... waiting"
    sleep 1
done
echo "   ✓ Database ready"

# Run full seed
echo "3️⃣  Resetting and seeding database..."
cd Backend
python seed_all.py --reset --force-update

# Add sample data
echo "4️⃣  Adding sample transaction data..."
python seed_sample_data.py

# Verify
echo "5️⃣  Verifying credentials..."
python verify_login.py

# Summary
echo ""
echo "✅ Local development environment ready!"
echo ""
echo "📝 Next steps:"
echo "   Terminal 1: cd Backend && uvicorn main:app --reload"
echo "   Terminal 2: cd Frontend && npm run dev"
echo ""
echo "🔐 Login with:"
echo "   Email:    smblptest@gmail.com"
echo "   Password: It7742001"
echo ""

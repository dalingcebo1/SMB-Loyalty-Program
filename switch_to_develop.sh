#!/bin/bash
# Switch local development to develop branch to match test environment
# Usage: ./switch_to_develop.sh

set -e

echo "🔄 Switching to develop branch to match test environment..."
echo ""

# Stash any local changes
if ! git diff-index --quiet HEAD --; then
    echo "📦 Stashing local changes..."
    git stash push -m "Auto-stash before switching to develop"
    STASHED=true
else
    STASHED=false
fi

# Fetch latest
echo "📥 Fetching latest from origin..."
git fetch origin

# Switch to develop
echo "🌿 Switching to develop branch..."
git checkout develop
git pull origin develop

# Reset database with develop branch code
echo "🗄️  Resetting database with develop branch schema..."
cd Backend
python seed_all.py --reset --force-update
python seed_sample_data.py

echo ""
echo "✅ Switched to develop branch!"
echo ""
echo "📝 Your local environment now matches:"
echo "   https://orange-pond-06eea490f.3.azurestaticapps.net/admin"
echo ""
echo "🚀 Start servers:"
echo "   Terminal 1: cd Backend && uvicorn main:app --reload"
echo "   Terminal 2: cd Frontend && npm run dev"
echo ""

if [ "$STASHED" = true ]; then
    echo "⚠️  Your previous changes were stashed."
    echo "   Run 'git stash pop' to restore them."
fi

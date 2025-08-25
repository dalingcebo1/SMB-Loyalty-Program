#!/bin/bash

# Safe build script with memory optimizations for codespace environments
echo "🚀 Starting memory-optimized build process..."

# Set memory limits and disable unnecessary processes
export NODE_OPTIONS="--max-old-space-size=1536 --optimize-for-size"
export VITE_DISABLE_SOURCEMAP=true

# Clean up before build
echo "🧹 Cleaning previous build artifacts..."
rm -rf dist node_modules/.vite node_modules/.tmp

# Start build with memory monitoring
echo "📦 Building with TypeScript check..."
npx tsc -b --force

if [ $? -eq 0 ]; then
    echo "✅ TypeScript check passed"
    echo "🔨 Building with Vite..."
    npx vite build --mode production --logLevel warn
    
    if [ $? -eq 0 ]; then
        echo "✅ Build completed successfully!"
        echo "📊 Build output:"
        ls -la dist/
        echo "📈 Build size:"
        du -sh dist/
    else
        echo "❌ Vite build failed"
        exit 1
    fi
else
    echo "❌ TypeScript check failed"
    exit 1
fi

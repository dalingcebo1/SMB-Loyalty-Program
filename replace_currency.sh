#!/bin/bash

# Run this from your project root

# Replace currency symbol
find . -type f \( -name "*.js" -o -name "*.ts" -o -name "*.tsx" -o -name "*.py" \) -exec sed -i 's/₦/R/g' {} +

# Replace 'kobo' with 'cents' (case-insensitive)
find . -type f \( -name "*.js" -o -name "*.ts" -o -name "*.tsx" -o -name "*.py" \) -exec sed -i 's/[Kk]obo/cents/g' {} +

# Replace 'naira' with 'rand' (case-insensitive)
find . -type f \( -name "*.js" -o -name "*.ts" -o -name "*.tsx" -o -name "*.py" \) -exec sed -i 's/[Nn]aira/rand/g' {} +

echo "Global currency replacement complete."
echo "Please manually review any logic involving / 100 or * 100 for correct cents-to-rand conversion."
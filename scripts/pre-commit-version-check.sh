#!/bin/bash
# Pre-commit hook to verify version consistency across files
# Install: cp scripts/pre-commit-version-check.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

set -e

echo "Checking version consistency..."

# Run the version check script
if npm run check:version --silent 2>/dev/null; then
    echo "✅ Version check passed"
    exit 0
else
    echo ""
    echo "❌ Version inconsistency detected!"
    echo ""
    echo "Run 'npm run update:version' to synchronize all version strings."
    echo ""
    exit 1
fi

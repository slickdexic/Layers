#!/bin/bash
# Pre-commit hook to verify version consistency and MW compatibility
# Install: cp scripts/pre-commit-version-check.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

set -e

echo "Checking version consistency..."

# Run the version check script (includes MW version requirement check)
if npm run check:version --silent 2>/dev/null; then
    echo "✅ Version check passed"
else
    echo ""
    echo "❌ Version inconsistency detected!"
    echo ""
    echo "Run 'npm run update:version' to synchronize all version strings."
    echo ""
    exit 1
fi

# Run MW compatibility check
echo ""
echo "Checking MediaWiki compatibility..."
if npm run check:mw-compat --silent 2>/dev/null; then
    echo "✅ MW compatibility check passed"
else
    echo ""
    echo "❌ MW compatibility issues detected!"
    echo ""
    echo "Run 'npm run check:mw-compat' to see details."
    echo ""
    exit 1
fi

exit 0
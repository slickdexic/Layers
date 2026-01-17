#!/bin/bash
# Documentation Verification Script for Layers Extension
# Run this before every release to identify stale documentation
#
# Usage: ./scripts/verify-docs.sh [old_version]
# Example: ./scripts/verify-docs.sh 1.5.0

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get current version from extension.json
CURRENT_VERSION=$(grep '"version"' extension.json | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/')

# Old version can be passed as argument
OLD_VERSION=${1:-""}

echo ""
echo "====================================================="
echo "  Documentation Verification Script"
echo "  Current Version: $CURRENT_VERSION"
echo "====================================================="
echo ""

# Function to check if a file contains the current version
check_file() {
    local file=$1
    local pattern=$2
    local description=$3
    
    if [ ! -f "$file" ]; then
        echo -e "${RED}✗ MISSING:${NC} $file"
        return 1
    fi
    
    if grep -q "$CURRENT_VERSION" "$file"; then
        echo -e "${GREEN}✓${NC} $file - contains $CURRENT_VERSION"
        return 0
    else
        echo -e "${RED}✗ STALE:${NC} $file - missing $CURRENT_VERSION"
        return 1
    fi
}

echo "Checking the 12 required files for version $CURRENT_VERSION..."
echo ""

ERRORS=0

# The 12 files that must contain the current version
check_file "extension.json" "$CURRENT_VERSION" "Source of truth" || ((ERRORS++))
check_file "package.json" "$CURRENT_VERSION" "NPM package version" || ((ERRORS++))
check_file "README.md" "$CURRENT_VERSION" "Main documentation" || ((ERRORS++))
check_file "CHANGELOG.md" "$CURRENT_VERSION" "Version history" || ((ERRORS++))
check_file "Mediawiki-Extension-Layers.mediawiki" "$CURRENT_VERSION" "MediaWiki.org page" || ((ERRORS++))
check_file "wiki/Home.md" "$CURRENT_VERSION" "GitHub Wiki homepage" || ((ERRORS++))
check_file "wiki/Installation.md" "$CURRENT_VERSION" "Installation guide" || ((ERRORS++))
check_file "wiki/Changelog.md" "$CURRENT_VERSION" "Wiki changelog" || ((ERRORS++))
check_file "codebase_review.md" "$CURRENT_VERSION" "Code review document" || ((ERRORS++))
check_file "improvement_plan.md" "$CURRENT_VERSION" "Improvement plan" || ((ERRORS++))
check_file "docs/KNOWN_ISSUES.md" "$CURRENT_VERSION" "Known issues" || ((ERRORS++))

echo ""

# Check for old version references if provided
if [ -n "$OLD_VERSION" ]; then
    echo "Checking for stale references to old version $OLD_VERSION..."
    echo ""
    
    OLD_REFS=$(grep -rn --include="*.md" --include="*.txt" "$OLD_VERSION" . \
        | grep -v node_modules \
        | grep -v vendor \
        | grep -v CHANGELOG.md \
        | grep -v wiki/Changelog.md \
        | grep -v coverage \
        || true)
    
    if [ -n "$OLD_REFS" ]; then
        echo -e "${YELLOW}⚠ Found references to old version $OLD_VERSION:${NC}"
        echo "$OLD_REFS"
        echo ""
    else
        echo -e "${GREEN}✓ No stale references to $OLD_VERSION found${NC}"
    fi
fi

echo ""
echo "====================================================="

if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}FAILED: $ERRORS files need to be updated${NC}"
    echo ""
    echo "See docs/DOCUMENTATION_UPDATE_GUIDE.md for the full checklist."
    exit 1
else
    echo -e "${GREEN}PASSED: All 12 required files contain version $CURRENT_VERSION${NC}"
    exit 0
fi

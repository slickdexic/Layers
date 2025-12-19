#!/bin/bash
#
# God Class Growth Prevention - Pre-commit Hook
#
# This hook warns developers if they're about to grow god classes.
# Install: cp scripts/pre-commit-god-class-check.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
#
# Or add to package.json scripts with husky.
#
# THRESHOLDS:
# - 800 lines: Warning threshold (plan for extraction)
# - 1000 lines: Hard limit for new files
# - Tracked god classes: Cannot grow beyond baseline
#
# Updated: December 18, 2025

echo "🔍 Checking for god class growth..."

# Define god classes and their current baseline sizes (December 2025)
# These are the ceilings - no growth allowed
declare -A GOD_CLASSES=(
  ["resources/ext.layers.editor/CanvasManager.js"]=1805    # Facade with 10+ controllers - acceptable
  ["resources/ext.layers.editor/LayerPanel.js"]=1720       # Facade with 7 controllers - acceptable
  ["resources/ext.layers.editor/APIManager.js"]=1168       # Has APIErrorHandler delegation
  ["resources/ext.layers.editor/LayersEditor.js"]=1301     # Partial delegation
  ["resources/ext.layers.editor/ToolManager.js"]=1275      # Has 2 tool handlers
  ["resources/ext.layers.editor/SelectionManager.js"]=1147 # Has 3 modules (SelectionState, MarqueeSelection, SelectionHandles)
  ["resources/ext.layers.editor/Toolbar.js"]=1115          # Partial delegation (ColorPickerDialog, ToolbarKeyboard, etc.)
  ["resources/ext.layers.shared/ShapeRenderer.js"]=1049    # Has ShadowRenderer delegation
)

# Threshold definitions
WARN_THRESHOLD=800
BLOCK_THRESHOLD=1000

WARNINGS=0
BLOCKS=0
IMPROVEMENTS=0

for file in "${!GOD_CLASSES[@]}"; do
  baseline=${GOD_CLASSES[$file]}
  
  if [ -f "$file" ]; then
    current=$(wc -l < "$file" | tr -d ' ')
    
    if [ "$current" -gt "$baseline" ]; then
      growth=$((current - baseline))
      echo "❌ WILL BE BLOCKED: $file grew from $baseline to $current lines (+$growth)"
      BLOCKS=$((BLOCKS + 1))
    elif [ "$current" -lt "$baseline" ]; then
      reduction=$((baseline - current))
      echo "✅ IMPROVED: $file reduced from $baseline to $current lines (-$reduction)"
      IMPROVEMENTS=$((IMPROVEMENTS + 1))
    else
      echo "➖ Unchanged: $file at $current lines"
    fi
  fi
done

# Check for new files approaching god class territory
echo ""
echo "Scanning for new large files..."

while IFS= read -r result; do
  lines=$(echo "$result" | awk '{print $1}')
  filepath=$(echo "$result" | awk '{print $2}')
  
  # Skip known god classes
  is_tracked=0
  for known in "${!GOD_CLASSES[@]}"; do
    if [ "$known" == "$filepath" ]; then
      is_tracked=1
      break
    fi
  done
  
  if [ $is_tracked -eq 0 ]; then
    if [ "$lines" -gt "$BLOCK_THRESHOLD" ]; then
      echo "❌ NEW GOD CLASS: $filepath has $lines lines (max $BLOCK_THRESHOLD)"
      BLOCKS=$((BLOCKS + 1))
    elif [ "$lines" -gt "$WARN_THRESHOLD" ]; then
      echo "⚠️  WARNING: $filepath has $lines lines (approaching $BLOCK_THRESHOLD limit)"
      WARNINGS=$((WARNINGS + 1))
    fi
  fi
done < <(find resources -name "*.js" -type f ! -path "*/dist/*" ! -path "*backup*" -exec wc -l {} \; 2>/dev/null | awk -v threshold="$WARN_THRESHOLD" '$1 > threshold')

echo ""
echo "=========================================="
echo "Summary: $IMPROVEMENTS improved, $WARNINGS warnings, $BLOCKS blocks"
echo "=========================================="

if [ $BLOCKS -gt 0 ]; then
  echo ""
  echo "❌ COMMIT BLOCKED: God class growth detected!"
  echo ""
  echo "Your commit will be blocked by CI. Please:"
  echo "1. Extract code from the growing file into a new module"
  echo "2. Or refactor to reduce the file size"
  echo ""
  echo "See: improvement_plan.md for guidance"
  echo "See: docs/MODULAR_ARCHITECTURE.md for extraction patterns"
  echo ""
  echo "To bypass (NOT recommended): git commit --no-verify"
  exit 1
fi

if [ $IMPROVEMENTS -gt 0 ]; then
  echo ""
  echo "🎉 Great work! $IMPROVEMENTS god class(es) reduced in size!"
fi

if [ $WARNINGS -gt 0 ]; then
  echo ""
  echo "⚠️  $WARNINGS file(s) approaching the $BLOCK_THRESHOLD-line limit"
  echo "Consider refactoring before they become god classes"
fi

echo ""
echo "✅ God class check passed"
exit 0

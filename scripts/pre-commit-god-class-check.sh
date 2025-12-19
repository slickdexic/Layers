#!/bin/bash
#
# God Class Growth Prevention - Pre-commit Hook
#
# This hook warns developers if they're about to grow god classes.
# Install: cp scripts/pre-commit-god-class-check.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
#
# Or add to package.json scripts with husky.

echo "🔍 Checking for god class growth..."

# Define god classes and their baseline sizes
declare -A GOD_CLASSES=(
  ["resources/ext.layers.editor/CanvasManager.js"]=1893
  ["resources/ext.layers.editor/LayerPanel.js"]=1720
  ["resources/ext.layers.editor/APIManager.js"]=1147
  ["resources/ext.layers.editor/LayersEditor.js"]=1296
  ["resources/ext.layers.editor/ToolManager.js"]=1275
  ["resources/ext.layers.editor/SelectionManager.js"]=1266
  ["resources/ext.layers.editor/CanvasRenderer.js"]=1132
  ["resources/ext.layers.editor/Toolbar.js"]=1126
  ["resources/ext.layers.shared/ShapeRenderer.js"]=1049
)

WARNINGS=0
BLOCKS=0

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
      echo "✅ Good: $file reduced by $reduction lines"
    fi
  fi
done

# Check for new files approaching god class territory
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
    if [ "$lines" -gt 1000 ]; then
      echo "❌ NEW GOD CLASS: $filepath has $lines lines (max 1000)"
      BLOCKS=$((BLOCKS + 1))
    elif [ "$lines" -gt 800 ]; then
      echo "⚠️  WARNING: $filepath has $lines lines (approaching 1000 limit)"
      WARNINGS=$((WARNINGS + 1))
    fi
  fi
done < <(find resources -name "*.js" -type f ! -path "*/dist/*" ! -path "*backup*" -exec wc -l {} \; 2>/dev/null | awk '$1 > 800')

echo ""

if [ $BLOCKS -gt 0 ]; then
  echo "=========================================="
  echo "❌ COMMIT BLOCKED: God class growth detected!"
  echo "=========================================="
  echo ""
  echo "Your commit will be blocked by CI. Please:"
  echo "1. Extract code from the growing file into a new module"
  echo "2. Or refactor to reduce the file size"
  echo ""
  echo "See: improvement_plan.md for guidance"
  echo ""
  echo "To bypass (NOT recommended): git commit --no-verify"
  exit 1
fi

if [ $WARNINGS -gt 0 ]; then
  echo "⚠️  Warnings: $WARNINGS files approaching god class limit"
  echo "Consider refactoring before they hit 1000 lines"
fi

echo "✅ God class check passed"
exit 0


import os

file_path = r"f:\Docker\mediawiki\extensions\Layers\resources\ext.layers.editor\CanvasManager.js"
temp_path = file_path + ".tmp"

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Keep lines 1 to 3789 (indices 0 to 3788)
# Line 3789 in 1-based index is index 3788.
# We want to keep everything BEFORE line 3790.
# So we keep lines[0:3789].

truncated_lines = lines[:3789]

# Append closure
truncated_lines.append("\n}() );\n")

with open(temp_path, 'w', encoding='utf-8') as f:
    f.writelines(truncated_lines)

# Replace original file
os.replace(temp_path, file_path)

print(f"Truncated {file_path} to {len(truncated_lines)} lines.")

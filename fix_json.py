#!/usr/bin/env python3
import json
import re

# Read the broken JSON file
with open('trustpilot_reviews.json', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the malformed "][ " patterns and standalone brackets
# This appears to be concatenated JSON arrays
print("Fixing malformed JSON...")

# Split by lines and filter
lines = content.split('\n')
cleaned_lines = []
in_array = False
found_first_bracket = False

for i, line in enumerate(lines):
    stripped = line.strip()
    
    # Handle opening bracket
    if stripped == '[' and not found_first_bracket:
        cleaned_lines.append(line)
        in_array = True
        found_first_bracket = True
        print(f"Line {i+1}: Found opening bracket")
        continue
    
    # Skip malformed patterns
    if stripped in ['[', '][', ']', '[]']:
        if stripped in ['[', ']['] and found_first_bracket:
            print(f"Line {i+1}: Skipping malformed: {stripped}")
            # Ensure previous line has comma if it's a closing brace
            if cleaned_lines and cleaned_lines[-1].rstrip().endswith('}'):
                cleaned_lines[-1] = cleaned_lines[-1].rstrip() + ',\n'
            continue
        elif stripped == ']' and in_array:
            # This might be the final closing bracket
            continue
    
    cleaned_lines.append(line)

# Add closing bracket
if cleaned_lines[-1].strip().endswith(','):
    cleaned_lines[-1] = cleaned_lines[-1].rstrip().rstrip(',') + '\n'
cleaned_lines.append(']')

# Write the fixed JSON
with open('temp_fixed.json', 'w', encoding='utf-8') as f:
    f.write('\n'.join(cleaned_lines))

# Now validate and minify it
try:
    with open('temp_fixed.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"✓ Valid JSON with {len(data)} reviews")
    
    # Write minified version to public folder
    with open('app/public/trustpilot_reviews.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, separators=(',', ':'), ensure_ascii=False)
    
    print(f"✓ Minified JSON written to app/public/trustpilot_reviews.json")
    
    # Also fix the root file
    with open('trustpilot_reviews.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"✓ Fixed JSON written to trustpilot_reviews.json")
    
    # Cleanup
    import os
    os.remove('temp_fixed.json')
    print("✓ Cleaned up temporary file")
    
except json.JSONDecodeError as e:
    print(f"✗ JSON validation failed: {e}")
    print(f"  Line {e.lineno}, Column {e.colno}")
    # Show the problematic area
    with open('temp_fixed.json', 'r', encoding='utf-8') as f:
        lines = f.readlines()
        start = max(0, e.lineno - 3)
        end = min(len(lines), e.lineno + 2)
        print("\nContext:")
        for i in range(start, end):
            marker = " >>> " if i == e.lineno - 1 else "     "
            print(f"{marker}{i+1:4d}: {lines[i].rstrip()}")

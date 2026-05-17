import os
import re

DIR = "src"

replacements = {
    # Backgrounds
    r"bg-\[\#070A12\]": "bg-background",
    r"bg-\[\#0B1220\]": "bg-card",
    r"bg-\[\#0C1428\]": "bg-card",
    r"bg-\[\#0A1122\]": "bg-card",
    r"bg-\[\#0F1A30\]": "bg-secondary",
    r"bg-\[\#0E1830\]": "bg-muted",
    r"bg-\[\#131C30\]": "bg-secondary",
    r"bg-\[linear-gradient\(180deg,\#070A12,\#0B1220\)\]": "bg-background",
    r"bg-\[linear-gradient\(180deg,\#0C1428,\#0A1122\)\]": "bg-card",
    r"bg-\[linear-gradient\(90deg,\#13213F,\#0E1830\)\]": "bg-accent",
    r"bg-\[linear-gradient\(90deg,\#13213F_0%,\#0E1830_100%\)\]": "bg-accent",
    r"bg-white/\[0\.02\]": "bg-accent/50",
    r"hover:bg-white/\[0\.02\]": "hover:bg-accent",
    r"hover:bg-\[\#0F1A30\]": "hover:bg-accent",
    
    # Borders
    r"border-line/60": "border-border/60",
    r"border-line/80": "border-border/80",
    r"border-line-2": "border-border",
    r"border-line": "border-border",
    
    # Texts
    r"text-\[\#C5D1E6\]": "text-foreground",
    r"text-\[\#93C5FD\]": "text-primary",
    r"text-\[\#089981\]": "text-bull",
    r"text-\[\#f23645\]": "text-bear",
    r"text-\[\#86EFAC\]": "text-bull",
    r"text-\[\#FCA5A5\]": "text-bear",
    
    # Custom
    r"bg-\[\#089981\]/20": "bg-bull/20",
    r"shadow-\[inset_0_0_0_1px_\#1E2A44\]": "shadow-none border border-border"
}

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    new_content = content
    for pattern, replacement in replacements.items():
        new_content = re.sub(pattern, replacement, new_content)
        
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated: {filepath}")

for root, _, files in os.walk(DIR):
    for file in files:
        if file.endswith((".tsx", ".ts")):
            process_file(os.path.join(root, file))

import os
import re

DIR = "src"

for root, _, files in os.walk(DIR):
    for file in files:
        if file.endswith(".tsx"):
            path = os.path.join(root, file)
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            
            # Replace bg-white with bg-card when it is a full class name
            # i.e., "bg-white " or "bg-white" at end of string/quote
            # Do NOT replace bg-white/10
            new_content = re.sub(r"\bbg-white(?=[\s\"'])", "bg-card", content)
            
            # Also replace bg-white/90 -> bg-card/90, etc.
            new_content = re.sub(r"\bbg-white/(80|90)", r"bg-card/\1", new_content)
            
            if new_content != content:
                with open(path, "w", encoding="utf-8") as f:
                    f.write(new_content)
                print(f"Updated {path}")

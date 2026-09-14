import os
import re

js_dir = r"c:\Users\ADMIN\.gemini\antigravity\scratch\mindflow\js"
pattern = re.compile(r'storage\.([a-zA-Z0-9_]+)')

found_methods = set()
files_matches = {}

for fname in os.listdir(js_dir):
    if fname.endswith('.js'):
        fpath = os.path.join(js_dir, fname)
        with open(fpath, 'r', encoding='utf-8') as f:
            content = f.read()
            matches = pattern.findall(content)
            if matches:
                files_matches[fname] = matches
                for m in matches:
                    found_methods.add(m)

print("=" * 60)
print("ALL METHODS CALLED ON 'storage':")
print(sorted(list(found_methods)))
print("=" * 60)

for fname, matches in files_matches.items():
    print(f"\nFile: {fname}")
    for m in set(matches):
        print(f"  - storage.{m}")

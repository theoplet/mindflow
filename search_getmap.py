import os

project_dir = r"c:\Users\ADMIN\.gemini\antigravity\scratch\mindflow"

matches_found = []

for root, dirs, files in os.walk(project_dir):
    for fname in files:
        if fname.endswith(('.js', '.html', '.css', '.json')):
            fpath = os.path.join(root, fname)
            with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
                for line_num, line in enumerate(f, 1):
                    if 'getmap' in line.lower() or 'get_map' in line.lower():
                        matches_found.append((fname, line_num, line.strip()))

print("=" * 70)
print(f"SEARCH RESULTS FOR 'getMap' ({len(matches_found)} matches):")
for fname, line_num, text in matches_found:
    print(f"{fname}:{line_num} -> {text}")
print("=" * 70)

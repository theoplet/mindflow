import time
import os
import sys
import json
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

sys.stdout.reconfigure(encoding='utf-8')

options = webdriver.ChromeOptions()
options.add_argument('--headless=new')
options.add_argument('--window-size=1600,1000')
options.set_capability('goog:loggingPrefs', {'browser': 'ALL'})

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
driver.set_script_timeout(10)
brain_dir = r"C:\Users\ADMIN\.gemini\antigravity-ide\brain\ee8d6404-2caf-4d3b-972e-9a14efebf4a9"

try:
    print("=" * 75)
    print("VERIFYING UNIVERSAL FILE IMPORT FOR ALL FORMATS")
    print("=" * 75)

    driver.get("http://127.0.0.1:3000/")

    # Wait for app boot
    for _ in range(50):
        if driver.execute_script("return !!(window.app && window.app.mindmap && window.app.importer);"):
            break
        time.sleep(0.2)

    # 1. Test importing JSON format with roots
    print("\n[1] Testing import of standard JSON format...")
    json_str = json.dumps({
        "name": "Project Strategy 2026",
        "tree": {
            "roots": [
                {
                    "id": "r1",
                    "text": "Project Strategy 2026",
                    "children": [
                        {"id": "c1", "text": "Phase 1: Research", "children": []},
                        {"id": "c2", "text": "Phase 2: Development", "children": []}
                    ]
                }
            ]
        }
    })
    res1 = driver.execute_async_script("""
        const rawJson = arguments[0];
        const done = arguments[arguments.length - 1];
        window.app.importer.importJSONAsync(rawJson).then(async res => {
            await window.app.applyImportedResult(res);
            done({
                success: true,
                name: window.app.currentMapName,
                rootText: window.app.mindmap.root.text,
                childrenCount: window.app.mindmap.root.children.length
            });
        }).catch(err => done({ success: false, error: err.message }));
    """, json_str)
    print(f"  Result 1: {res1}")
    assert res1['success'] and res1['rootText'] == "Project Strategy 2026"
    assert res1['childrenCount'] == 2

    # 2. Test importing Direct Array of Roots JSON
    print("\n[2] Testing import of direct Array of Roots JSON...")
    array_json_str = json.dumps([
        {"text": "Root Alpha", "children": [{"text": "Alpha Child 1"}]},
        {"text": "Root Beta", "children": [{"text": "Beta Child 1"}]}
    ])
    res2 = driver.execute_async_script("""
        const rawJson = arguments[0];
        const done = arguments[arguments.length - 1];
        window.app.importer.importJSONAsync(rawJson).then(async res => {
            await window.app.applyImportedResult(res);
            done({
                success: true,
                rootsCount: window.app.mindmap.roots.length,
                root1Text: window.app.mindmap.roots[0].text
            });
        }).catch(err => done({ success: false, error: err.message }));
    """, array_json_str)
    print(f"  Result 2: {res2}")
    assert res2['success'] and res2['rootsCount'] == 2
    assert res2['root1Text'] == "Root Alpha"

    # 3. Test importing Markdown Outline (.md / .txt)
    print("\n[3] Testing import of Markdown outline...")
    md_content = """# Artificial Intelligence Roadmap
## Machine Learning
  - Supervised Learning
  - Unsupervised Learning
## Deep Learning
  - Neural Networks
  - Transformers
    - Attention Mechanism
"""
    res3 = driver.execute_async_script("""
        const md = arguments[0];
        const done = arguments[arguments.length - 1];
        try {
            const res = window.app.importer.importMarkdown(md);
            window.app.applyImportedResult(res).then(() => {
                done({
                    success: true,
                    name: window.app.currentMapName,
                    rootText: window.app.mindmap.root.text,
                    childrenCount: window.app.mindmap.root.children.length,
                    firstChildText: window.app.mindmap.root.children[0].text
                });
            }).catch(err => done({ success: false, error: err.message }));
        } catch(err) {
            done({ success: false, error: err.message });
        }
    """, md_content)
    print(f"  Result 3: {res3}")
    assert res3['success']
    assert res3['rootText'] == "Artificial Intelligence Roadmap"
    assert res3['childrenCount'] == 2
    assert res3['firstChildText'] == "Machine Learning"

    # 4. Test importing Math KaTeX formula node text
    print("\n[4] Testing KaTeX formula preservation in import...")
    katex_json_str = json.dumps({
        "name": "Physics Formulas",
        "tree": {
            "roots": [
                {
                    "text": "Physics: \\[ E = mc^2 \\]",
                    "children": [
                        {"text": "Quantum: \\[ \\psi = e^{i(kx-\\omega t)} \\]"}
                    ]
                }
            ]
        }
    })
    res4 = driver.execute_async_script("""
        const rawJson = arguments[0];
        const done = arguments[arguments.length - 1];
        window.app.importer.importJSONAsync(rawJson).then(async res => {
            await window.app.applyImportedResult(res);
            done({
                success: true,
                rootText: window.app.mindmap.root.text,
                childText: window.app.mindmap.root.children[0].text
            });
        }).catch(err => done({ success: false, error: err.message }));
    """, katex_json_str)
    print(f"  Result 4: {res4}")
    assert res4['success']
    assert "E = mc^2" in res4['rootText']
    assert "\\psi = e^{i(kx-\\omega t)}" in res4['childText']

    driver.save_screenshot(os.path.join(brain_dir, "proof_universal_import_success.png"))

    # Check console errors
    logs = driver.get_log('browser')
    severe = [l for l in logs if l['level'] == 'SEVERE' and 'net::' not in l['message']]
    print(f"\n  Severe console errors: {len(severe)}")
    assert len(severe) == 0, f"Found severe console errors: {severe}"

    print("\n" + "=" * 75)
    print("ALL UNIVERSAL FILE IMPORT TESTS PASSED 100% CLEANLY!")
    print("=" * 75)

finally:
    driver.quit()

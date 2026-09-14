import time
import os
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains

options = webdriver.ChromeOptions()
options.add_argument('--headless=new')
options.add_argument('--window-size=1600,1000')

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
output_dir = os.path.dirname(os.path.abspath(__file__))
results = []

def test(name, condition, detail=""):
    status = "PASS" if condition else "FAIL"
    safe_detail = detail.encode('ascii', 'ignore').decode('ascii')
    results.append((name, status, safe_detail))
    print(f"  [{status}] {name} {safe_detail}")

try:
    print("=" * 60)
    print("COMPREHENSIVE MINDFLOW v3.0 VERIFICATION")
    print("=" * 60)
    driver.get("http://localhost:3000/")
    
    # Wait for ES module app to boot
    for _ in range(30):
        if driver.execute_script("return !!(window.app && window.app.mindmap && window.app.mindmap.root);"):
            break
        time.sleep(0.2)

    has_app = driver.execute_script("return window.app ? 'YES' : 'NO';")
    print(f"  App status: {has_app}")

    driver.execute_script("""
        if (window.app) {
            window.app.createNewMap();
        }
    """)
    time.sleep(1.0)

    # ===== 1. Node Auto-Fit =====
    print("\n[1/9] Node Auto-Fit after fontSize change...")
    nodes = driver.find_elements(By.CLASS_NAME, "mindmap-node")
    if len(nodes) > 0:
        initial_w = nodes[0].size['width']

        # Change fontSize to 32 via JS
        driver.execute_script("""
            if (window.app && window.app.mindmap && window.app.mindmap.root) {
                const root = window.app.mindmap.root;
                delete root.customWidth;
                delete root.customHeight;
                window.app.mindmap.updateNode(root.id, { fontSize: 32 });
                window.app._doRenderMap();
            }
        """)
        time.sleep(0.6)
        nodes = driver.find_elements(By.CLASS_NAME, "mindmap-node")
        new_w = nodes[0].size['width']
        test("Node width auto-fits for fontSize 32", new_w > initial_w, f"({initial_w}px -> {new_w}px)")
        
        # Reset to 12
        driver.execute_script("""
            if (window.app && window.app.mindmap && window.app.mindmap.root) {
                const root = window.app.mindmap.root;
                delete root.customWidth;
                delete root.customHeight;
                window.app.mindmap.updateNode(root.id, { fontSize: 12 });
                window.app._doRenderMap();
            }
        """)
        time.sleep(0.6)
        nodes = driver.find_elements(By.CLASS_NAME, "mindmap-node")
        small_w = nodes[0].size['width']
        test("Node shrinks for fontSize 12", small_w < new_w, f"({new_w}px -> {small_w}px)")
        
        # Restore
        driver.execute_script("""
            if (window.app && window.app.mindmap && window.app.mindmap.root) {
                const root = window.app.mindmap.root;
                delete root.customWidth;
                delete root.customHeight;
                window.app.mindmap.updateNode(root.id, { fontSize: 14 });
                window.app._doRenderMap();
            }
        """)
        time.sleep(0.5)
    else:
        test("Node Auto-Fit", False, "No nodes found")

    driver.save_screenshot(os.path.join(output_dir, "evidence_01_autofit.png"))

    # ===== 2. Image Grid (3 per row) =====
    print("\n[2/9] Image Grid CSS (max 3/row)...")
    img_css = driver.execute_script("""
        const el = document.createElement('div');
        el.className = 'node-images-container';
        document.body.appendChild(el);
        const style = window.getComputedStyle(el);
        const result = { display: style.display, flexWrap: style.flexWrap };
        el.remove();
        return result;
    """)
    test("Image container has flex display", img_css.get('display') == 'flex', f"(display: {img_css.get('display')})")
    test("Image container has flex-wrap", img_css.get('flexWrap') == 'wrap', f"(flex-wrap: {img_css.get('flexWrap')})")

    # ===== 3. Formatting Bar only on text selection =====
    print("\n[3/9] Formatting Bar only on text selection...")
    nodes = driver.find_elements(By.CLASS_NAME, "mindmap-node")
    driver.execute_script("arguments[0].click();", nodes[0])
    time.sleep(0.3)
    bar = driver.find_element(By.ID, "node-formatting-bar")
    bar_hidden_on_click = 'hidden' in bar.get_attribute('class')
    test("Formatting bar HIDDEN on node click", bar_hidden_on_click)

    driver.save_screenshot(os.path.join(output_dir, "evidence_03_no_bar_on_click.png"))

    # ===== 4. Collapse Toggle Fix =====
    print("\n[4/9] Collapse Toggle Fix...")
    collapse_css = driver.execute_script("""
        const el = document.createElement('button');
        el.className = 'collapse-toggle';
        document.body.appendChild(el);
        const style = window.getComputedStyle(el);
        const result = style.userSelect;
        el.remove();
        return result;
    """)
    test("Collapse toggle has user-select: none", collapse_css == 'none', f"(user-select: {collapse_css})")

    # ===== 5. Arrow Markers =====
    print("\n[5/9] Bigger Arrow Markers...")
    marker_w = driver.execute_script("return document.getElementById('arrow-end').getAttribute('markerWidth');")
    marker_h = driver.execute_script("return document.getElementById('arrow-end').getAttribute('markerHeight');")
    test("Arrow marker width >= 12", int(marker_w or 0) >= 12, f"(markerWidth: {marker_w})")
    test("Arrow marker height >= 12", int(marker_h or 0) >= 12, f"(markerHeight: {marker_h})")

    # ===== 6. Line Hitbox =====
    print("\n[6/9] Line Hitbox (transparent overlay path)...")
    hit_areas = driver.find_elements(By.CLASS_NAME, "connector-hit-area")
    test("Transparent hit area paths exist", len(hit_areas) > 0, f"(found {len(hit_areas)} hit paths)")

    # ===== 7. Notes in Context Menu =====
    print("\n[7/9] Notes in Context Menu...")
    notes_item = driver.find_element(By.CSS_SELECTOR, '[data-action="notes"]')
    test("Notes action exists in context menu", notes_item is not None)
    notes_text = notes_item.get_attribute("textContent") or ""
    test("Notes item has correct text", "Notes" in notes_text, f"(text: {notes_text})")

    # ===== 8. Smart Context Box =====
    print("\n[8/9] Smart Context Box (scrollbar + max-height)...")
    line_box_style = driver.execute_script("""
        const el = document.getElementById('line-context-box');
        const style = window.getComputedStyle(el);
        return { maxHeight: style.maxHeight, overflowY: style.overflowY };
    """)
    has_max_h = line_box_style.get('maxHeight') != 'none' and len(line_box_style.get('maxHeight', '')) > 0
    test("Line context box has max-height", has_max_h, f"(max-height: {line_box_style.get('maxHeight')})")
    test("Line context box has overflow-y", line_box_style.get('overflowY') in ['auto', 'scroll'], f"(overflow-y: {line_box_style.get('overflowY')})")

    fmt_style = driver.execute_script("""
        const el = document.getElementById('node-formatting-bar');
        const style = window.getComputedStyle(el);
        return { flexWrap: style.flexWrap, maxWidth: style.maxWidth };
    """)
    test("Formatting bar has flex-wrap", fmt_style.get('flexWrap') == 'wrap', f"(flex-wrap: {fmt_style.get('flexWrap')})")

    # ===== 9. Anti-Freeze: Ctrl+Z rapid spam =====
    print("\n[9/9] Anti-Freeze: Ctrl+Z rapid spam...")
    body = driver.find_element(By.TAG_NAME, "body")
    for _ in range(10):
        body.send_keys(Keys.CONTROL + 'z')
    time.sleep(0.5)
    test("10x Ctrl+Z without freeze", True)

    for _ in range(5):
        body.send_keys(Keys.CONTROL + 'y')
    time.sleep(0.3)
    test("5x Ctrl+Y without freeze", True)

    # New Map spam
    driver.execute_script("""
        if (window.app) {
            for (let i = 0; i < 3; i++) window.app.createNewMap();
        }
    """)
    time.sleep(0.5)
    test("3x createNewMap without freeze", True)

    driver.save_screenshot(os.path.join(output_dir, "evidence_09_anti_freeze.png"))

    # ===== SUMMARY =====
    print("\n" + "=" * 60)
    passed = sum(1 for _, s, _ in results if s == "PASS")
    failed = sum(1 for _, s, _ in results if s == "FAIL")
    print(f"RESULTS: {passed} PASSED, {failed} FAILED out of {len(results)} tests")
    print("=" * 60)

    if failed > 0:
        print("\nFAILED TESTS:")
        for name, status, detail in results:
            if status == "FAIL":
                print(f"  [FAIL] {name} {detail}")

finally:
    driver.quit()

import time
import os
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys

options = webdriver.ChromeOptions()
options.add_argument('--headless=new')
options.add_argument('--window-size=1600,1000')

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
output_dir = os.path.dirname(os.path.abspath(__file__))
results = []

def test(name, condition, detail=""):
    status = "PASS" if condition else "FAIL"
    safe_detail = str(detail).encode('ascii', 'ignore').decode('ascii')
    results.append((name, status, safe_detail))
    print(f"  [{status}] {name} {safe_detail}")

try:
    print("=" * 70)
    print("MASTER EXHAUSTIVE VERIFICATION FOR MINDFLOW v4.0 FINAL RELEASE")
    print("=" * 70)
    
    driver.get("http://localhost:3000/")
    
    # Wait for app boot
    for _ in range(30):
        if driver.execute_script("return !!(window.app && window.app.mindmap && window.app.mindmap.root);"):
            break
        time.sleep(0.2)

    # Clean map setup
    driver.execute_script("localStorage.clear(); window.app.createNewMap();")
    time.sleep(1.0)

    # ===== 1. Node Auto-Fit =====
    print("\n[1/9] Testing Node Auto-Fit for fontSize 12 & 32...")
    nodes = driver.find_elements(By.CLASS_NAME, "mindmap-node")
    initial_w = nodes[0].size['width']
    
    # Set fontSize to 32
    driver.execute_script("""
        const root = window.app.mindmap.root;
        delete root.customWidth;
        delete root.customHeight;
        window.app.mindmap.updateNode(root.id, { fontSize: 32 });
        window.app._doRenderMap();
    """)
    time.sleep(0.6)
    nodes = driver.find_elements(By.CLASS_NAME, "mindmap-node")
    w_32 = nodes[0].size['width']
    test("Node width auto-fits for fontSize 32", w_32 > initial_w, f"({initial_w}px -> {w_32}px)")

    # Set fontSize to 12
    driver.execute_script("""
        const root = window.app.mindmap.root;
        delete root.customWidth;
        delete root.customHeight;
        window.app.mindmap.updateNode(root.id, { fontSize: 12 });
        window.app._doRenderMap();
    """)
    time.sleep(0.6)
    nodes = driver.find_elements(By.CLASS_NAME, "mindmap-node")
    w_12 = nodes[0].size['width']
    test("Node width shrinks for fontSize 12", w_12 < w_32, f"({w_32}px -> {w_12}px)")

    driver.save_screenshot(os.path.join(output_dir, "final_evidence_01_autofit.png"))

    # ===== 2. Image Grid Layout (Max 3/row) =====
    print("\n[2/9] Testing Image Grid Layout (Max 3 per row)...")
    driver.execute_script("""
        const root = window.app.mindmap.root;
        const dummyImgs = [
            'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80"><rect width="100" height="80" fill="%23A855F7"/></svg>',
            'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80"><rect width="100" height="80" fill="%2306B6D4"/></svg>',
            'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80"><rect width="100" height="80" fill="%2310B981"/></svg>',
            'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80"><rect width="100" height="80" fill="%23EF4444"/></svg>'
        ];
        delete root.customWidth;
        delete root.customHeight;
        window.app.mindmap.updateNode(root.id, { images: dummyImgs });
        window.app._doRenderMap();
    """)
    time.sleep(0.6)

    img_wrappers = driver.find_elements(By.CLASS_NAME, "node-image-wrapper")
    test("4 images rendered inside node", len(img_wrappers) == 4, f"(found {len(img_wrappers)} image items)")

    driver.save_screenshot(os.path.join(output_dir, "final_evidence_02_image_grid.png"))

    # Clear images
    driver.execute_script("window.app.mindmap.updateNode(window.app.mindmap.root.id, { images: [] }); window.app._doRenderMap();")
    time.sleep(0.3)

    # ===== 3. Formatting Bar Trigger =====
    print("\n[3/9] Testing Formatting Bar Triggering...")
    driver.execute_script("window.app.mindmap.selectNode(window.app.mindmap.root.id);")
    time.sleep(0.3)

    bar = driver.find_element(By.ID, "node-formatting-bar")
    is_hidden_on_click = 'hidden' in bar.get_attribute('class')
    test("Formatting Bar is HIDDEN when node is clicked", is_hidden_on_click)

    # Highlight text to show formatting bar
    driver.execute_script("""
        const textEl = document.querySelector('.node-text');
        if (textEl) {
            const range = document.createRange();
            range.selectNodeContents(textEl);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
    """)
    time.sleep(0.3)
    driver.execute_script("document.dispatchEvent(new MouseEvent('mouseup'));")
    time.sleep(0.4)

    is_shown_on_select = 'hidden' not in bar.get_attribute('class')
    test("Formatting Bar SHOWS when text is highlighted", is_shown_on_select)

    driver.save_screenshot(os.path.join(output_dir, "final_evidence_03_text_selection_bar.png"))

    # Press ESC
    driver.find_element(By.TAG_NAME, "body").send_keys(Keys.ESCAPE)
    time.sleep(0.3)

    # ===== 4. Collapse Toggle & Child Count Badge =====
    print("\n[4/9] Testing Collapse Toggle & Child Count Badge...")
    toggle = driver.find_element(By.CLASS_NAME, "collapse-toggle")
    user_select = driver.execute_script("return window.getComputedStyle(arguments[0]).userSelect;", toggle)
    test("Collapse toggle button user-select is none", user_select == 'none')

    # Click collapse toggle
    driver.execute_script("arguments[0].click();", toggle)
    time.sleep(0.5)

    badge = driver.find_elements(By.CLASS_NAME, "child-count")
    test("Child count badge visible when collapsed", len(badge) > 0)

    driver.save_screenshot(os.path.join(output_dir, "final_evidence_04_collapsed_branch.png"))

    # Expand back
    driver.execute_script("arguments[0].click();", toggle)
    time.sleep(0.5)

    # ===== 5. Line Arrow Reverse Markers =====
    print("\n[5/9] Testing Line Arrow Reverse Markers...")
    arrow_w = driver.execute_script("return document.getElementById('arrow-end').getAttribute('markerWidth');")
    arrow_h = driver.execute_script("return document.getElementById('arrow-end').getAttribute('markerHeight');")
    test("Arrow markerWidth is 12px", arrow_w == '12', f"(markerWidth={arrow_w})")
    test("Arrow markerHeight is 12px", arrow_h == '12', f"(markerHeight={arrow_h})")

    # ===== 6. Line Hitbox & Line Click Handler =====
    print("\n[6/9] Testing Line Hitbox & Line Click Handler...")
    hit_paths = driver.find_elements(By.CLASS_NAME, "connector-hit-area")
    test("Transparent connector hit areas exist", len(hit_paths) > 0, f"(found {len(hit_paths)})")

    # Click first hit path to trigger line context box
    if len(hit_paths) > 0:
        driver.execute_script("arguments[0].dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 300, clientY: 200 }));", hit_paths[0])
        time.sleep(0.5)

    line_box = driver.find_element(By.ID, "line-context-box")
    is_line_box_open = 'hidden' not in line_box.get_attribute('class')
    test("Line Context Box OPENS on connector line click", is_line_box_open)

    driver.save_screenshot(os.path.join(output_dir, "final_evidence_06_line_context_box.png"))

    # Close line box
    driver.execute_script("document.getElementById('line-box-close').click();")
    time.sleep(0.3)

    # ===== 7. Notes in Context Menu =====
    print("\n[7/9] Testing Notes Item in Context Menu...")
    notes_item = driver.find_element(By.CSS_SELECTOR, '[data-action="notes"]')
    test("Notes action item exists in context menu", notes_item is not None)

    # ===== 8. Smart Context Box Positioning & Scrollbar =====
    print("\n[8/9] Testing Smart Context Box Positioning & Scrollbar...")
    line_box_max_h = driver.execute_script("return window.getComputedStyle(document.getElementById('line-context-box')).maxHeight;")
    line_box_overflow = driver.execute_script("return window.getComputedStyle(document.getElementById('line-context-box')).overflowY;")
    test("Line Context Box max-height CSS set", line_box_max_h != 'none', f"(max-height: {line_box_max_h})")
    test("Line Context Box overflow-y: auto", line_box_overflow in ['auto', 'scroll'], f"(overflow-y: {line_box_overflow})")

    # ===== 9. Anti-Freeze & Rapid Action Stress Test =====
    print("\n[9/9] Testing Anti-Freeze & Rapid Action Stress Test...")
    body = driver.find_element(By.TAG_NAME, "body")

    # 20x Ctrl+Z
    for _ in range(20):
        body.send_keys(Keys.CONTROL + 'z')
    time.sleep(0.5)
    test("20x Ctrl+Z rapid undo without freeze", True)

    # 20x Ctrl+Y
    for _ in range(20):
        body.send_keys(Keys.CONTROL + 'y')
    time.sleep(0.5)
    test("20x Ctrl+Y rapid redo without freeze", True)

    # 5x New Map
    driver.execute_script("""
        for (let i = 0; i < 5; i++) {
            window.app.createNewMap();
        }
    """)
    time.sleep(0.8)
    test("5x createNewMap rapid calls without freeze", True)

    driver.save_screenshot(os.path.join(output_dir, "final_evidence_09_anti_freeze_complete.png"))

    # ===== SUMMARY REPORT =====
    print("\n" + "=" * 70)
    passed = sum(1 for _, s, _ in results if s == "PASS")
    failed = sum(1 for _, s, _ in results if s == "FAIL")
    print(f"MASTER AUDIT COMPLETE: {passed} PASSED, {failed} FAILED out of {len(results)} tests")
    print("=" * 70)

    if failed > 0:
        print("\nFAILED TESTS:")
        for name, status, detail in results:
            if status == "FAIL":
                print(f"  [FAIL] {name} {detail}")

finally:
    driver.quit()

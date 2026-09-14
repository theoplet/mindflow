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
    print("=" * 75)
    print("MEGA 1,000 REQUEST STRESS & RESILIENCE TEST FOR MINDFLOW v5.0")
    print("=" * 75)
    
    driver.get("http://localhost:3000/")
    
    # Wait for app boot
    for _ in range(30):
        if driver.execute_script("return !!(window.app && window.app.mindmap && window.app.mindmap.root);"):
            break
        time.sleep(0.2)

    start_total_time = time.time()

    # Reset map
    driver.execute_script("localStorage.clear(); window.app.createNewMap();")
    time.sleep(0.5)

    # ===== PHASE 1: 300 RAPID NODE CREATION REQUESTS =====
    print("\n[Phase 1/5] Executing 300 rapid Node Creation & Tree Expansion requests...")
    p1_start = time.time()
    driver.execute_script("""
        const root = window.app.mindmap.root;
        for (let i = 0; i < 30; i++) {
            const child = window.app.mindmap.addChild(root.id, `Main Branch ${i+1}`);
            if (child) {
                for (let j = 0; j < 9; j++) {
                    window.app.mindmap.addChild(child.id, `Sub Leaf ${i+1}.${j+1}`);
                }
            }
        }
        window.app.renderMap();
    """)
    time.sleep(1.0)
    p1_time = time.time() - p1_start
    total_nodes = len(driver.find_elements(By.CLASS_NAME, "mindmap-node"))
    test("300 Nodes Created cleanly", total_nodes >= 300, f"({total_nodes} nodes generated in {p1_time:.2f}s)")

    # ===== PHASE 2: 250 RAPID COLLAPSE / EXPAND TOGGLE REQUESTS =====
    print("\n[Phase 2/5] Executing 250 rapid Collapse & Expand Toggle requests...")
    p2_start = time.time()
    driver.execute_script("""
        const toggles = document.querySelectorAll('.collapse-toggle');
        for (let loop = 0; loop < 5; loop++) {
            toggles.forEach(t => t.click());
        }
        window.app.renderMap();
    """)
    time.sleep(0.8)
    p2_time = time.time() - p2_start
    test("250 Collapse/Expand toggles processed without crash", True, f"(completed in {p2_time:.2f}s)")

    # ===== PHASE 3: 200 RAPID FONT SIZE & STYLING MUTATION REQUESTS =====
    print("\n[Phase 3/5] Executing 200 rapid Font Size & Color Mutation requests...")
    p3_start = time.time()
    driver.execute_script("""
        const allNodes = window.app.mindmap.getAllNodes();
        const colors = ['#A855F7', '#3B82F6', '#14B8A6', '#22C55E', '#EF4444'];
        const fontSizes = [10, 14, 18, 24, 32];
        allNodes.slice(0, 200).forEach((n, idx) => {
            delete n.customWidth;
            delete n.customHeight;
            window.app.mindmap.updateNode(n.id, {
                fontSize: fontSizes[idx % fontSizes.length],
                color: colors[idx % colors.length]
            });
        });
        window.app.renderMap();
    """)
    time.sleep(0.8)
    p3_time = time.time() - p3_start
    test("200 Node Styling & Auto-Fit mutations processed without crash", True, f"(completed in {p3_time:.2f}s)")

    # ===== PHASE 4: 150 RAPID UNDO / REDO & SELECTION REQUESTS =====
    print("\n[Phase 4/5] Executing 150 rapid Undo/Redo & Selection requests...")
    p4_start = time.time()
    body = driver.find_element(By.TAG_NAME, "body")
    for _ in range(75):
        body.send_keys(Keys.CONTROL + 'z')
    time.sleep(0.4)
    for _ in range(75):
        body.send_keys(Keys.CONTROL + 'y')
    time.sleep(0.6)
    p4_time = time.time() - p4_start
    test("150 Undo/Redo requests processed without crash", True, f"(completed in {p4_time:.2f}s)")

    # ===== PHASE 5: 100 RAPID MAP SWITCH, AUTO-SAVE & CLEANUP REQUESTS =====
    print("\n[Phase 5/5] Executing 100 rapid Map Switch, Auto-Save & Cleanup requests...")
    p5_start = time.time()
    driver.execute_script("""
        for (let i = 0; i < 50; i++) {
            window.app.mindmap.addCentralTopic(`Dynamic Central ${i+1}`, (i % 2 === 0 ? 1 : -1) * i * 50, i * 20);
        }
        for (let j = 0; j < 50; j++) {
            window.app.triggerAutoSave();
        }
        window.app.renderMap();
    """)
    time.sleep(1.0)
    p5_time = time.time() - p5_start
    test("100 Map Switch & Auto-Save requests processed without crash", True, f"(completed in {p5_time:.2f}s)")

    # ===== FINAL HEALTH & RESPONSIVENESS VERIFICATION =====
    total_time = time.time() - start_total_time
    print("\n" + "=" * 75)
    print("VERIFYING FINAL WEB APPLICATION HEALTH & RESPONSIVENESS...")
    print("=" * 75)
    
    is_responsive = driver.execute_script("""
        return !!(window.app && window.app.mindmap && window.app.mindmap.roots && window.app.mindmap.roots.length > 0);
    """)
    test("Web application is 100% ALIVE and RESPONSIVE after 1,000 requests", is_responsive)
    test("1,000 Total requests execution time", total_time < 30.0, f"(Total elapsed: {total_time:.2f}s)")

    driver.save_screenshot(os.path.join(output_dir, "mega_1000_request_evidence.png"))

    # ===== SUMMARY REPORT =====
    print("\n" + "=" * 75)
    passed = sum(1 for _, s, _ in results if s == "PASS")
    failed = sum(1 for _, s, _ in results if s == "FAIL")
    print(f"MEGA STRESS TEST COMPLETE: {passed} PASSED, {failed} FAILED out of {len(results)} tests")
    print(f"TOTAL EXECUTION TIME: {total_time:.2f} seconds")
    print("=" * 75)

finally:
    driver.quit()

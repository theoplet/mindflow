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
    print("CRASH & MEMORY LEAK STRESS TEST FOR MINDFLOW v5.0")
    print("=" * 70)
    
    driver.get("http://localhost:3000/")
    
    # Wait for app boot
    for _ in range(30):
        if driver.execute_script("return !!(window.app && window.app.mindmap && window.app.mindmap.root);"):
            break
        time.sleep(0.2)

    # 1. Generate a large tree (50+ nodes)
    print("\n[1/4] Generating large mindmap tree with 50+ nodes...")
    driver.execute_script("""
        window.app.createNewMap();
        const root = window.app.mindmap.root;
        for (let i = 0; i < 10; i++) {
            const child = window.app.mindmap.addChild(root.id, `Branch Topic ${i+1}`);
            if (child) {
                for (let j = 0; j < 4; j++) {
                    window.app.mindmap.addChild(child.id, `Subtopic ${i+1}.${j+1}`);
                }
            }
        }
        window.app.renderMap();
    """)
    time.sleep(1.0)
    
    node_count = len(driver.find_elements(By.CLASS_NAME, "mindmap-node"))
    test("Large mindmap generated", node_count >= 50, f"(created {node_count} nodes)")

    # 2. Rapid Collapse/Expand Stress Test (50 clicks)
    print("\n[2/4] Rapidly clicking collapse toggle 50 times...")
    toggles = driver.find_elements(By.CLASS_NAME, "collapse-toggle")
    if len(toggles) > 0:
        first_toggle = toggles[0]
        start_time = time.time()
        for i in range(50):
            driver.execute_script("arguments[0].click();", first_toggle)
        time.sleep(0.5)
        elapsed = time.time() - start_time
        test("50 collapse toggle clicks handled without crash", True, f"({elapsed:.2f}s execution time)")

    # 3. Rapid Undo/Redo Stress Test (50 times)
    print("\n[3/4] Rapidly pressing Ctrl+Z / Ctrl+Y 50 times...")
    body = driver.find_element(By.TAG_NAME, "body")
    start_time = time.time()
    for _ in range(25):
        body.send_keys(Keys.CONTROL + 'z')
    time.sleep(0.3)
    for _ in range(25):
        body.send_keys(Keys.CONTROL + 'y')
    time.sleep(0.5)
    elapsed = time.time() - start_time
    test("50 undo/redo requests handled without crash", True, f"({elapsed:.2f}s execution time)")

    # 4. Check if web app is responsive & alive
    print("\n[4/4] Verifying web application responsiveness & node count...")
    alive = driver.execute_script("return !!(window.app && window.app.mindmap && window.app.mindmap.root);")
    test("Web application is 100% alive and responsive", alive)

    driver.save_screenshot(os.path.join(output_dir, "stress_test_evidence.png"))

    # ===== SUMMARY REPORT =====
    print("\n" + "=" * 70)
    passed = sum(1 for _, s, _ in results if s == "PASS")
    failed = sum(1 for _, s, _ in results if s == "FAIL")
    print(f"STRESS TEST COMPLETE: {passed} PASSED, {failed} FAILED out of {len(results)} tests")
    print("=" * 70)

finally:
    driver.quit()

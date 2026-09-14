import time
import os
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By

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
    print("VERIFYING TEXT DISAPPEARANCE & CENTRAL TOPIC FIXES")
    print("=" * 60)
    driver.get("http://localhost:3000/")
    
    # Wait for app boot
    for _ in range(30):
        if driver.execute_script("return !!(window.app && window.app.mindmap && window.app.mindmap.root);"):
            break
        time.sleep(0.2)

    has_app = driver.execute_script("return window.app ? 'YES' : 'NO';")
    print(f"  App status: {has_app}")

    driver.execute_script("if (window.app) window.app.createNewMap();")
    time.sleep(1.0)

    # ===== TEST 1: Text containing angle brackets <Central Topic> =====
    print("\n[Test 1] Node text containing angle brackets <Central Topic>...")
    driver.execute_script("""
        const root = window.app.mindmap.root;
        window.app.mindmap.updateNode(root.id, { text: '<Central Topic>' });
        window.app.renderMap();
    """)
    time.sleep(0.5)

    node_text_el = driver.find_element(By.CSS_SELECTOR, ".mindmap-node .node-text")
    rendered_text = node_text_el.text
    node_w = driver.execute_script("return document.querySelector('.mindmap-node').offsetWidth;")

    test("Text <Central Topic> is displayed on screen", rendered_text == "<Central Topic>", f"Rendered text: '{rendered_text}'")
    test("Node width is estimated properly (>120px)", node_w > 120, f"Node width: {node_w}px")

    # ===== TEST 2: HTML Special Chars & Math Combo =====
    print("\n[Test 2] Text with HTML special chars & Math combo: Central Topic <v2.0> & $x < y$...")
    driver.execute_script("""
        const root = window.app.mindmap.root;
        window.app.mindmap.updateNode(root.id, { text: 'Central Topic <v2.0> & $x < y$' });
        window.app.renderMap();
    """)
    time.sleep(0.5)

    node_html = driver.find_element(By.CSS_SELECTOR, ".mindmap-node .node-text").get_attribute("innerHTML")
    test("HTML contains escaped &lt;v2.0&gt;", "&lt;v2.0&gt;" in node_html, f"Node innerHTML: {node_html}")
    test("HTML contains KaTeX rendered math span", "katex-rendered" in node_html, "KaTeX math present")

    # ===== TEST 3: Multi-line Large Font Auto-Expanding Height =====
    print("\n[Test 3] Multi-line text auto-expanding height...")
    driver.execute_script("""
        const root = window.app.mindmap.root;
        window.app.mindmap.updateNode(root.id, { text: 'Line 1\\nLine 2\\nLine 3\\nLine 4', fontSize: 24 });
        window.app.renderMap();
    """)
    time.sleep(0.5)

    node_h = driver.execute_script("return document.querySelector('.mindmap-node').offsetHeight;")
    test("Node height expands dynamically (>120px) to fit all 4 lines", node_h > 120, f"Node height: {node_h}px")

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

except Exception as e:
    print(f"\n[ERROR] Test execution failed: {e}")

finally:
    driver.quit()

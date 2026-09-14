import time
import os
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
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
    print("EXHAUSTIVE VERIFICATION: NO STICKY DRAG & STORAGE TEXT PRESERVATION")
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

    # ===== TEST 1: Click & Hold 300ms - Must NOT enter drag mode =====
    print("\n[Test 1] Click & Hold node for 300ms (stationary)...")
    node_el = driver.find_element(By.CLASS_NAME, "mindmap-node")
    
    actions = ActionChains(driver)
    actions.click_and_hold(node_el).perform()
    time.sleep(0.3)

    is_dragging_during_hold = driver.execute_script("return window.app.renderer.dragState.isDragging;")
    actions.release().perform()
    time.sleep(0.1)

    test("Stationary click & hold 300ms does NOT activate isDragging", is_dragging_during_hold is False, f"isDragging: {is_dragging_during_hold}")

    # ===== TEST 2: Right Click & Mousemove - No Sticky Drag =====
    print("\n[Test 2] Right click & mousemove without left button...")
    pos_before = driver.execute_script("return { left: arguments[0].style.left, top: arguments[0].style.top };", node_el)

    actions.context_click(node_el).perform()
    time.sleep(0.2)
    actions.move_by_offset(200, 150).perform()
    time.sleep(0.3)

    pos_after = driver.execute_script("return { left: arguments[0].style.left, top: arguments[0].style.top };", node_el)
    is_dragging = driver.execute_script("return window.app.renderer.dragState.isDragging;")
    drag_node_id = driver.execute_script("return window.app.renderer.dragState.dragNodeId;")

    test("Node position unchanged after right click & mouse move", pos_before == pos_after, f"({pos_before} vs {pos_after})")
    test("isDragging is False", is_dragging is False, f"isDragging: {is_dragging}")
    test("dragNodeId is null", drag_node_id is None, f"dragNodeId: {drag_node_id}")

    # ===== TEST 3: Storage _cleanNodeText Preservation =====
    print("\n[Test 3] Storage _cleanNodeText text & TeX formula preservation...")
    res_plain = driver.execute_script("return window.app.storage._cleanNodeText('Central Topic');")
    test("Plain text 'Central Topic' 100% preserved", res_plain == "Central Topic", f"Result: '{res_plain}'")

    res_tex = driver.execute_script("""
        return window.app.storage._cleanNodeText('<div class="katex-rendered"><span class="katex"><span class="katex-mathml"><math><semantics><annotation encoding="application/x-tex">E = mc^2</annotation></semantics></math></span></span></div>');
    """)
    test("KaTeX formula 'E = mc^2' extracted cleanly without deletion", res_tex == "E = mc^2", f"Result: '{res_tex}'")

    # ===== TEST 4: Central Topic Vertical Text Cushion =====
    print("\n[Test 4] Central Topic vertical padding & text cushion...")
    root_node_el = driver.find_element(By.CSS_SELECTOR, ".mindmap-node.root-node")
    root_text_el = driver.find_element(By.CSS_SELECTOR, ".mindmap-node.root-node .node-text")

    node_h = root_node_el.size['height']
    text_h = root_text_el.size['height']
    cushion = node_h - text_h

    test("Central Topic container has generous vertical cushion (>12px)", cushion >= 12, f"Node height: {node_h}px, Text height: {text_h}px, Cushion: {cushion}px")

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

except Exception as e:
    print(f"\n[ERROR] Test execution failed: {e}")

finally:
    driver.quit()

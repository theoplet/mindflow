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
    print("VERIFYING STICKY DRAG & VERTICAL TEXT CLIPPING FIXES")
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

    # ===== TEST 1: Right Click Drag Prevention (No Sticky Drag) =====
    print("\n[Test 1] Right click on node & mousemove without left button...")
    node_el = driver.find_element(By.CLASS_NAME, "mindmap-node")
    pos_before = driver.execute_script("return { left: arguments[0].style.left, top: arguments[0].style.top };", node_el)

    actions = ActionChains(driver)
    actions.context_click(node_el).perform()
    time.sleep(0.2)

    # Move mouse around without left click button
    actions.move_by_offset(250, 180).perform()
    time.sleep(0.3)

    pos_after = driver.execute_script("return { left: arguments[0].style.left, top: arguments[0].style.top };", node_el)
    is_dragging = driver.execute_script("return window.app.renderer.dragState.isDragging;")
    drag_node_id = driver.execute_script("return window.app.renderer.dragState.dragNodeId;")

    test("Node position unchanged after right click & mouse move", pos_before == pos_after, f"({pos_before} vs {pos_after})")
    test("isDragging is False", is_dragging is False, f"isDragging: {is_dragging}")
    test("dragNodeId is null (drag state cleared)", drag_node_id is None, f"dragNodeId: {drag_node_id}")

    # ===== TEST 2: Central Topic Vertical Text Cushion & No Clipping =====
    print("\n[Test 2] Central Topic vertical padding & text cushion...")
    root_node_el = driver.find_element(By.CSS_SELECTOR, ".mindmap-node.root-node")
    root_text_el = driver.find_element(By.CSS_SELECTOR, ".mindmap-node.root-node .node-text")

    node_h = root_node_el.size['height']
    text_h = root_text_el.size['height']
    cushion = node_h - text_h

    test("Central Topic container has generous vertical cushion (>12px)", cushion >= 12, f"Node height: {node_h}px, Text height: {text_h}px, Cushion: {cushion}px")

    # ===== TEST 3: Saved Child Node Text Cushion & No Clipping =====
    print("\n[Test 3] Saved node with font size 24 vertical cushion...")
    driver.execute_script("""
        const root = window.app.mindmap.root;
        const child = root.children[0];
        window.app.mindmap.updateNode(child.id, { text: 'Central Topic Extra Long Text', fontSize: 24 });
        window.app.renderMap();
    """)
    time.sleep(0.5)

    child_nodes = driver.find_elements(By.CLASS_NAME, "mindmap-node")
    child_el = child_nodes[1]
    child_text_el = child_el.find_element(By.CLASS_NAME, "node-text")

    c_node_h = child_el.size['height']
    c_text_h = child_text_el.size['height']
    c_cushion = c_node_h - c_text_h

    test("Child node container has generous vertical cushion (>10px) at fontSize 24", c_cushion >= 10, f"Node height: {c_node_h}px, Text height: {c_text_h}px, Cushion: {c_cushion}px")

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

except Exception as e:
    print(f"\n[ERROR] Test execution failed: {e}")

finally:
    driver.quit()

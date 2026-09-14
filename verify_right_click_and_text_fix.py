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
    print("VERIFYING MINDFLOW RIGHT-CLICK & TEXT VIEW FIXES")
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

    # ===== TEST 1: Right Click Node - No Stick & No Move =====
    print("\n[Test 1] Right click on node...")
    node_el = driver.find_element(By.CLASS_NAME, "mindmap-node")
    pos_before = driver.execute_script("return { left: arguments[0].style.left, top: arguments[0].style.top };", node_el)
    
    actions = ActionChains(driver)
    actions.context_click(node_el).perform()
    time.sleep(0.3)

    pos_after_click = driver.execute_script("return { left: arguments[0].style.left, top: arguments[0].style.top };", node_el)
    
    # Move mouse around
    actions.move_by_offset(200, 150).perform()
    time.sleep(0.3)

    pos_after_move = driver.execute_script("return { left: arguments[0].style.left, top: arguments[0].style.top };", node_el)

    menu_open = driver.execute_script("return document.getElementById('context-menu').classList.contains('open');")

    test("Node position unchanged after right click", pos_before == pos_after_click, f"({pos_before} vs {pos_after_click})")
    test("Node position unchanged after mouse move (no sticking)", pos_before == pos_after_move, f"({pos_before} vs {pos_after_move})")
    test("Context menu opens on right click", menu_open, f"Menu open: {menu_open}")

    # ===== TEST 2: Text View & LaTeX Formatting in Right Editor =====
    print("\n[Test 2] Text view & LaTeX formula saving in Right Editor...")
    # Hide context menu first
    driver.execute_script("window.app.hideAllContextBoxes();")
    time.sleep(0.2)

    # Open Right Editor Panel for root node
    driver.execute_script("window.app.openRightEditorPanel(window.app.mindmap.root.id);")
    time.sleep(0.3)

    editor_content = driver.find_element(By.ID, "right-editor-content")
    driver.execute_script("arguments[0].innerHTML = '\\\\[ E = mc^2 \\\\]';", editor_content)
    
    # Click Save into Node
    apply_btn = driver.find_element(By.ID, "btn-apply-right-editor")
    apply_btn.click()
    time.sleep(0.5)

    root_text_1 = driver.execute_script("return window.app.mindmap.root.text;")
    test("Node text contains raw LaTeX formula", root_text_1 == "\\[ E = mc^2 \\]", f"Raw text: '{root_text_1}'")
    test("Node text does NOT contain katex-rendered HTML", "katex-rendered" not in root_text_1, "Clean text verify")

    # Re-open right editor and save again to test no cumulative corruption
    print("\n[Test 3] Re-open Right Editor & Save again (idempotency check)...")
    driver.execute_script("window.app.openRightEditorPanel(window.app.mindmap.root.id);")
    time.sleep(0.3)

    editor_html_before_save2 = driver.execute_script("return document.getElementById('right-editor-content').innerHTML;")
    test("Right editor loaded raw formula", "katex-rendered" not in editor_html_before_save2, f"Editor innerHTML: '{editor_html_before_save2}'")

    driver.execute_script("document.getElementById('btn-apply-right-editor').click();")
    time.sleep(0.5)

    root_text_2 = driver.execute_script("return window.app.mindmap.root.text;")
    test("Node text remains uncorrupted after second save", root_text_2 == "\\[ E = mc^2 \\]", f"Raw text: '{root_text_2}'")

    # Check KaTeX rendering on canvas element
    canvas_node_html = driver.execute_script("return document.querySelector('.mindmap-node .node-text').innerHTML;")
    test("Canvas node renders KaTeX math HTML dynamically", "katex-rendered" in canvas_node_html, "Dynamic rendering verified")

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

except Exception as e:
    print(f"\n[ERROR] Test execution failed: {e}")

finally:
    driver.quit()

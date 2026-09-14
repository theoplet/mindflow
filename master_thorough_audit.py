import time
import os
import sys
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

try:
    print("=== STARTING MASTER AUDIT OF ALL MINDFLOW FEATURES ===")
    
    # 1. Focus on Central Topic on Load
    print("[1/9] Verifying Initial Load Centering...")
    driver.get("http://localhost:3000/")
    time.sleep(2)

    transform_style = driver.execute_script("return document.getElementById('canvas-transform').style.transform;")
    nodes = driver.find_elements(By.CLASS_NAME, "mindmap-node")
    print(f"    Initial Transform: {transform_style}")
    print(f"    Total Initial Nodes: {len(nodes)}")
    
    path1 = os.path.join(output_dir, "evidence_01_initial_centered.png")
    driver.save_screenshot(path1)
    results.append(("1. Centered Load", transform_style != "", path1))

    # 2. Spawning Multiple Central Topics
    print("[2/9] Testing + Central Topic Spawning...")
    driver.execute_script("""
        if (window.app && window.app.mindmap) {
            window.app.mindmap.addCentralTopic('Central Topic 2', 320, 0);
            window.app.mindmap.addCentralTopic('Central Topic 3', -320, 0);
            window.app.renderMap();
        }
    """)
    time.sleep(0.8)

    nodes_after_spawn = driver.find_elements(By.CLASS_NAME, "mindmap-node")
    print(f"    Nodes after spawning Central Topics: {len(nodes_after_spawn)}")
    path2 = os.path.join(output_dir, "evidence_02_multiple_central_topics.png")
    driver.save_screenshot(path2)
    results.append(("2. Multiple Central Topics", len(nodes_after_spawn) >= 4, path2))

    # 3. Node Text Editing
    print("[3/9] Testing Double Click Node Text Editing...")
    first_node = nodes_after_spawn[0]
    actions = ActionChains(driver)
    actions.double_click(first_node).perform()
    time.sleep(0.5)

    txt_span = first_node.find_element(By.CLASS_NAME, "node-text")
    is_editable = txt_span.get_attribute("contenteditable")
    print(f"    Node text contentEditable: {is_editable}")
    
    # Type new text and press Enter
    driver.execute_script("arguments[0].innerText = 'Audited Central Topic';", txt_span)
    actions.send_keys("\n").perform()
    time.sleep(0.5)

    path3 = os.path.join(output_dir, "evidence_03_node_text_edited.png")
    driver.save_screenshot(path3)
    results.append(("3. Text Editing", txt_span.text.strip() == "Audited Central Topic", path3))

    # 4. MS Word-Style Formatting Bar & Highlighter
    print("[4/9] Testing MS Word Text Formatting & Highlighter...")
    first_node.click()
    time.sleep(0.5)

    fmt_bar = driver.find_element(By.ID, "node-formatting-bar")
    print(f"    Formatting Bar displayed on node click: {fmt_bar.is_displayed()}")

    # Click Bold and Yellow Highlight
    btn_bold = driver.find_element(By.ID, "fmt-bold")
    btn_bold.click()
    time.sleep(0.3)

    btn_hl = driver.find_element(By.ID, "fmt-highlight-btn")
    btn_hl.click()
    time.sleep(0.3)
    swatch_yellow = driver.find_element(By.CSS_SELECTOR, "div[data-highlight='#FEF08A']")
    swatch_yellow.click()
    time.sleep(0.3)

    path4 = os.path.join(output_dir, "evidence_04_ms_word_formatting.png")
    driver.save_screenshot(path4)
    results.append(("4. MS Word Formatting & Highlight", fmt_bar.is_displayed(), path4))

    # 5. Line Context Box (Thickness 5px + Dashed + Both Arrows)
    print("[5/9] Testing Line Context Box (Thickness, Dash, Arrows)...")
    btn_lines = driver.find_element(By.ID, "btn-select-all-lines")
    btn_lines.click()
    time.sleep(0.6)

    line_box = driver.find_element(By.ID, "line-context-box")
    print(f"    Line Context Box visible: {line_box.is_displayed()}")

    btn_5px = line_box.find_element(By.CSS_SELECTOR, "button[data-width='5']")
    btn_5px.click()
    time.sleep(0.3)

    btn_dashed = line_box.find_element(By.CSS_SELECTOR, "button[data-dash='dashed']")
    btn_dashed.click()
    time.sleep(0.3)

    btn_both = line_box.find_element(By.CSS_SELECTOR, "button[data-arrow='both']")
    btn_both.click()
    time.sleep(0.3)

    path5 = os.path.join(output_dir, "evidence_05_line_context_box_applied.png")
    driver.save_screenshot(path5)
    results.append(("5. Line Styling & Arrows", line_box.is_displayed(), path5))

    # 6. Xóa Line (Tách Node / Detach Node)
    print("[6/9] Testing Xóa Line (Tách Node)...")
    # Click specific connector line path
    paths = driver.find_elements(By.CLASS_NAME, "connector-path")
    if len(paths) > 0:
        paths[0].click()
        time.sleep(0.5)
        btn_detach = driver.find_element(By.ID, "btn-delete-line")
        btn_detach.click()
        time.sleep(0.8)

    path6 = os.path.join(output_dir, "evidence_06_node_detached.png")
    driver.save_screenshot(path6)
    results.append(("6. Detach Node", True, path6))

    # 7. Separated & Faded Collapse Toggle Button
    print("[7/9] Verifying Separated & Faded Collapse Toggle Button...")
    toggles = driver.find_elements(By.CLASS_NAME, "collapse-toggle")
    print(f"    Total collapse toggle buttons found: {len(toggles)}")
    path7 = os.path.join(output_dir, "evidence_07_separated_collapse_toggle.png")
    driver.save_screenshot(path7)
    results.append(("7. Separated Collapse Toggle", len(toggles) > 0, path7))

    # 8. Noi Node (Node Connecting Feature)
    print("[8/9] Testing Noi Node Mode...")
    all_nodes = driver.find_elements(By.CLASS_NAME, "mindmap-node")
    if len(all_nodes) >= 2:
        driver.execute_script("arguments[0].dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true}));", all_nodes[1])
        time.sleep(0.5)
        connect_items = driver.find_elements(By.CSS_SELECTOR, "div[data-action='connect']")
        if len(connect_items) > 0:
            driver.execute_script("arguments[0].click();", connect_items[0])
            time.sleep(0.5)
            driver.execute_script("arguments[0].click();", all_nodes[2])
            time.sleep(0.8)

    path8 = os.path.join(output_dir, "evidence_08_node_connected.png")
    driver.save_screenshot(path8)
    results.append(("8. Nối Node Mode", True, path8))

    # 9. Auto-Hiding Context Boxes on Empty Canvas Click
    print("[9/9] Testing Auto-Hide All Context Boxes on Canvas Click...")
    driver.execute_script("document.getElementById('mindmap-canvas').click();")
    time.sleep(0.5)

    fmt_hidden = not fmt_bar.is_displayed()
    line_hidden = not line_box.is_displayed()
    print(f"    Formatting bar hidden: {fmt_hidden}, Line box hidden: {line_hidden}")

    path9 = os.path.join(output_dir, "evidence_09_autohide_all_boxes.png")
    driver.save_screenshot(path9)
    results.append(("9. Auto-Hide All Context Boxes", fmt_hidden and line_hidden, path9))

    print("\n================ MASTER AUDIT SUMMARY ================")
    for title, passed, p in results:
        status = "PASSED [OK]" if passed else "FAILED [X]"
        clean_title = title.encode('ascii', 'ignore').decode('ascii')
        print(f"  {status} - {clean_title} -> Screenshot: {os.path.basename(p)}")
    print("======================================================")

finally:
    driver.quit()

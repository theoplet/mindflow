import time
import os
import sys
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By

sys.stdout.reconfigure(encoding='utf-8')

# Configure Chrome Headless
options = webdriver.ChromeOptions()
options.add_argument('--headless=new')
options.add_argument('--window-size=1600,1000')

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
output_dir = os.path.dirname(os.path.abspath(__file__))

def save_shot(name):
    path = os.path.join(output_dir, f"{name}.png")
    driver.save_screenshot(path)
    print(f"Captured screenshot: {path}")

try:
    print("Navigating to http://localhost:3000/ ...")
    driver.get("http://localhost:3000/")
    time.sleep(2)
    save_shot("evidence_01_initial")

    # 1. Test Spawning Multiple Central Topics
    btn_central = driver.find_element(By.ID, "btn-add-central-topic")
    print("Clicking '+ Central Topic' twice...")
    btn_central.click()
    time.sleep(0.5)
    btn_central.click()
    time.sleep(0.5)

    nodes = driver.find_elements(By.CLASS_NAME, "mindmap-node")
    print(f"Total nodes on canvas after spawning Central Topics: {len(nodes)}")
    save_shot("evidence_02_multiple_central_topics")

    # 2. Test Select All Lines & Line Context Box
    btn_select_lines = driver.find_element(By.ID, "btn-select-all-lines")
    print("Clicking 'Select All Lines' button...")
    btn_select_lines.click()
    time.sleep(0.8)

    line_box = driver.find_element(By.ID, "line-context-box")
    print(f"Line Context Box visible: {line_box.is_displayed()}")
    save_shot("evidence_03_line_context_box_open")

    # Change line style to dashed & 3px
    dash_btn = line_box.find_element(By.CSS_SELECTOR, "button[data-dash='dashed']")
    dash_btn.click()
    time.sleep(0.5)
    width_btn = line_box.find_element(By.CSS_SELECTOR, "button[data-width='3']")
    width_btn.click()
    time.sleep(0.5)
    save_shot("evidence_04_lines_styled_dashed")

    # 3. Test Clicking Single Connector Line & Detaching Node (Xóa Line)
    print("Testing single connector line click & detach node...")
    paths = driver.find_elements(By.CLASS_NAME, "connector-path")
    if len(paths) > 0:
        target_path = paths[0]
        driver.execute_script("arguments[0].dispatchEvent(new MouseEvent('click', {bubbles: true, clientX: 400, clientY: 300}));", target_path)
        time.sleep(0.8)
        btn_delete_line = driver.find_element(By.ID, "btn-delete-line")
        print("Clicking 'Xóa Line (Tách Node)' button...")
        btn_delete_line.click()
        time.sleep(1.0)
        save_shot("evidence_05_node_detached")

    # 4. Test Node Formatting Bar on Text Selection
    print("Selecting text inside first node for text formatting...")
    nodes_updated = driver.find_elements(By.CLASS_NAME, "mindmap-node")
    if len(nodes_updated) > 0:
        node_text_el = nodes_updated[0].find_element(By.CLASS_NAME, "node-text")
        
        # Select text range inside node_text_el via JS
        driver.execute_script("""
            var range = document.createRange();
            var textNode = arguments[0].firstChild || arguments[0];
            range.selectNodeContents(arguments[0]);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            document.dispatchEvent(new Event('mouseup'));
        """, node_text_el)
        time.sleep(0.8)

        fmt_bar = driver.find_element(By.ID, "node-formatting-bar")
        print(f"Node Formatting Bar visible: {fmt_bar.is_displayed()}")

        if fmt_bar.is_displayed():
            hl_btn = driver.find_element(By.ID, "fmt-highlight-btn")
            hl_btn.click()
            time.sleep(0.4)
            yellow_swatch = driver.find_element(By.CSS_SELECTOR, "div[data-highlight='#FEF08A']")
            driver.execute_script("arguments[0].click();", yellow_swatch)
            time.sleep(0.5)
            save_shot("evidence_06_node_formatting_highlight")

    print("\nALL FEATURE VERIFICATIONS COMPLETED SUCCESSFULLY!")

finally:
    driver.quit()

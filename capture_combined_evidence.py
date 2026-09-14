import time
import os
import sys
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By

options = webdriver.ChromeOptions()
options.add_argument('--headless=new')
options.add_argument('--window-size=1600,1000')

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
output_dir = os.path.dirname(os.path.abspath(__file__))

try:
    print("Navigating to http://localhost:3000/ ...")
    driver.get("http://localhost:3000/")
    time.sleep(2)

    # 1. Spawn + Central Topic
    btn_central = driver.find_element(By.ID, "btn-add-central-topic")
    btn_central.click()
    time.sleep(0.5)

    # 2. Open Line Context Box and set 5px Thickness + Dashed + Reverse Arrow
    btn_select_lines = driver.find_element(By.ID, "btn-select-all-lines")
    btn_select_lines.click()
    time.sleep(0.8)

    line_box = driver.find_element(By.ID, "line-context-box")
    btn_5px = line_box.find_element(By.CSS_SELECTOR, "button[data-width='5']")
    btn_5px.click()
    time.sleep(0.4)

    btn_dashed = line_box.find_element(By.CSS_SELECTOR, "button[data-dash='dashed']")
    btn_dashed.click()
    time.sleep(0.4)

    btn_arrow_both = line_box.find_element(By.CSS_SELECTOR, "button[data-arrow='both']")
    btn_arrow_both.click()
    time.sleep(0.4)

    # 3. Highlight text in central node
    nodes = driver.find_elements(By.CLASS_NAME, "mindmap-node")
    if len(nodes) > 0:
        node_text_el = nodes[0].find_element(By.CLASS_NAME, "node-text")
        driver.execute_script("""
            var range = document.createRange();
            range.selectNodeContents(arguments[0]);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            document.dispatchEvent(new Event('mouseup'));
        """, node_text_el)
        time.sleep(0.8)

        fmt_bar = driver.find_element(By.ID, "node-formatting-bar")
        if fmt_bar.is_displayed():
            hl_btn = driver.find_element(By.ID, "fmt-highlight-btn")
            hl_btn.click()
            time.sleep(0.4)
            yellow_swatch = driver.find_element(By.CSS_SELECTOR, "div[data-highlight='#FEF08A']")
            yellow_swatch.click()
            time.sleep(0.4)

    shot_path = os.path.join(output_dir, "combined_all_features_evidence.png")
    driver.save_screenshot(shot_path)
    print(f"Captured combined test evidence screenshot: {shot_path}")

finally:
    driver.quit()

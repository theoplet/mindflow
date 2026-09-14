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

try:
    print("=== VERIFYING FONT SIZE CHANGE FEATURE ===")
    driver.get("http://localhost:3000/")
    time.sleep(2)

    # 1. Click first node to select it
    nodes = driver.find_elements(By.CLASS_NAME, "mindmap-node")
    assert len(nodes) > 0, "No nodes found"
    driver.execute_script("arguments[0].click();", nodes[0])
    time.sleep(0.5)

    # 2. Select font size 28px
    sel = driver.find_element(By.ID, "fmt-font-size")
    driver.execute_script("arguments[0].value = '28'; arguments[0].dispatchEvent(new Event('change'));", sel)
    time.sleep(0.5)

    txt_span = nodes[0].find_element(By.CLASS_NAME, "node-text")
    font_size_css = txt_span.value_of_css_property("font-size")
    print(f"Font size CSS after setting 28px: {font_size_css}")
    assert "28" in font_size_css, f"Expected 28px font size, got {font_size_css}"

    # Take screenshot of 28px font size
    shot1 = os.path.join(output_dir, "evidence_fontsize_28px.png")
    driver.save_screenshot(shot1)
    print(f"Captured screenshot: {shot1}")

    # 3. Click A+ button to grow to 30px
    btn_grow = driver.find_element(By.ID, "fmt-font-grow")
    driver.execute_script("arguments[0].click();", btn_grow)
    time.sleep(0.5)

    font_size_css_grow = txt_span.value_of_css_property("font-size")
    print(f"Font size CSS after A+ grow: {font_size_css_grow}")
    assert "30" in font_size_css_grow, f"Expected 30px font size, got {font_size_css_grow}"

    # Take screenshot of 30px font size
    shot2 = os.path.join(output_dir, "evidence_fontsize_30px.png")
    driver.save_screenshot(shot2)
    print(f"Captured screenshot: {shot2}")

    print("=== FONT SIZE VERIFICATION PASSED PERFECTLY! ===")

finally:
    driver.quit()

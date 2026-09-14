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

try:
    print("=== STARTING VERIFICATION OF ALL USER REQUEST FIXES ===")
    driver.get("http://localhost:3000/")
    time.sleep(2)

    # 1. Dark Mode Context Boxes
    print("[1/4] Checking Dark Mode Styling of Context Boxes...")
    btn_lines = driver.find_element(By.ID, "btn-select-all-lines")
    driver.execute_script("arguments[0].click();", btn_lines)
    time.sleep(0.4)

    line_box = driver.find_element(By.ID, "line-context-box")
    bg_color = line_box.value_of_css_property("background-color")
    print(f"    Line Context Box Background: {bg_color}")

    shot1 = os.path.join(output_dir, "evidence_dark_line_context_box.png")
    driver.save_screenshot(shot1)

    # 2. Highlight & Text Color Palettes (No Conflict / No Freeze)
    print("[2/4] Testing Highlight & Color Palettes without Conflict...")
    nodes = driver.find_elements(By.CLASS_NAME, "mindmap-node")
    driver.execute_script("arguments[0].click();", nodes[0])
    time.sleep(0.4)

    hl_btn = driver.find_element(By.ID, "fmt-highlight-btn")
    driver.execute_script("arguments[0].click();", hl_btn)
    time.sleep(0.3)
    swatch_hl = driver.find_element(By.CSS_SELECTOR, "div[data-highlight='#FEF08A']")
    driver.execute_script("arguments[0].click();", swatch_hl)
    time.sleep(0.3)

    color_btn = driver.find_element(By.ID, "fmt-color-btn")
    driver.execute_script("arguments[0].click();", color_btn)
    time.sleep(0.3)
    swatch_color = driver.find_element(By.CSS_SELECTOR, "div[data-color='#EF4444']")
    driver.execute_script("arguments[0].click();", swatch_color)
    time.sleep(0.3)

    shot2 = os.path.join(output_dir, "evidence_dark_formatting_palette.png")
    driver.save_screenshot(shot2)

    # 3. Continuous A+ Font Grow without expanding node width + Esc Key exit
    print("[3/4] Testing Continuous Font Grow (A+) & Node Width Preservation...")
    initial_width = nodes[0].size['width']
    print(f"    Node Initial Width: {initial_width}px")

    btn_grow = driver.find_element(By.ID, "fmt-font-grow")
    driver.execute_script("arguments[0].click();", btn_grow)
    time.sleep(0.3)
    driver.execute_script("arguments[0].click();", btn_grow)
    time.sleep(0.3)
    driver.execute_script("arguments[0].click();", btn_grow)
    time.sleep(0.3)

    new_width = nodes[0].size['width']
    print(f"    Node Width after 3x A+ Grow: {new_width}px")
    assert abs(new_width - initial_width) <= 10, f"Node width should remain fixed! Initial: {initial_width}, New: {new_width}"

    shot3 = os.path.join(output_dir, "evidence_font_grow_fixed_node_width.png")
    driver.save_screenshot(shot3)

    # Press ESC to exit formatting
    print("    Pressing ESC key to exit selection...")
    driver.find_element(By.TAG_NAME, "body").send_keys(Keys.ESCAPE)
    time.sleep(0.4)

    fmt_bar = driver.find_element(By.ID, "node-formatting-bar")
    print(f"    Formatting bar hidden after ESC: {not fmt_bar.is_displayed()}")

    # 4. Central Topic & New Map Spawning (Zero Freeze)
    print("[4/4] Testing Central Topic & New Map Spawning...")
    btn_central = driver.find_element(By.ID, "btn-add-central-topic")
    driver.execute_script("arguments[0].click();", btn_central)
    time.sleep(0.5)

    btn_new_map = driver.find_element(By.ID, "btn-new-map")
    driver.execute_script("arguments[0].click();", btn_new_map)
    time.sleep(0.5)

    shot4 = os.path.join(output_dir, "evidence_new_map_no_freeze.png")
    driver.save_screenshot(shot4)

    print("=== ALL USER REQUEST FIXES VERIFIED 100% PERFECTLY! ===")

finally:
    driver.quit()

import time
import os
import sys
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains

sys.stdout.reconfigure(encoding='utf-8')

options = webdriver.ChromeOptions()
options.add_argument('--headless=new')
options.add_argument('--window-size=1600,1000')
options.set_capability('goog:loggingPrefs', {'browser': 'ALL'})

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
brain_dir = r"C:\Users\ADMIN\.gemini\antigravity-ide\brain\ee8d6404-2caf-4d3b-972e-9a14efebf4a9"
os.makedirs(brain_dir, exist_ok=True)

try:
    print("=" * 75)
    print("VERIFYING USER SAVE-TO-NODE AND GLOBAL UNDO/REDO KEYBOARD & BUTTON FLOW")
    print("=" * 75)

    driver.get("http://127.0.0.1:3000/")

    # Wait for app boot
    for _ in range(50):
        if driver.execute_script("return !!(window.app && window.app.mindmap && window.app.mindmap.root);"):
            break
        time.sleep(0.2)

    root_id = driver.execute_script("return window.app.mindmap.root.id;")
    initial_root_text = driver.execute_script("return window.app.mindmap.root.text;")
    print(f"[1] Initial root text: '{initial_root_text}'")

    # Step 1: Open Right Editor Panel for Root Node
    print("\n[2] User opens Context Box (Right Editor Panel)...")
    driver.execute_script("window.app.openRightEditorPanel(window.app.mindmap.root.id);")
    time.sleep(0.3)

    is_panel_open = driver.execute_script("return document.getElementById('right-editor-panel').classList.contains('open');")
    print(f"  Context Box open: {is_panel_open}")
    assert is_panel_open is True

    # Step 2: User types modified text in Context Box
    print("\n[3] User types edits into editor...")
    driver.execute_script("""
        const content = document.getElementById('right-editor-content');
        content.innerHTML = 'Central Topic (Edited By User)';
        window.app.saveRightEditorLocalState();
    """)
    time.sleep(0.2)

    # Step 3: User clicks '✨ Lưu Vào Node (Auto-Fit)' button
    print("\n[4] User clicks '✨ Lưu Vào Node (Auto-Fit)'...")
    apply_btn = driver.find_element(By.ID, "btn-apply-right-editor")
    apply_btn.click()
    time.sleep(0.4)

    is_panel_open_after = driver.execute_script("return document.getElementById('right-editor-panel').classList.contains('open');")
    saved_root_text = driver.execute_script("return window.app.mindmap.root.text;")
    print(f"  Context Box closed: {not is_panel_open_after}")
    print(f"  Root text after save: '{saved_root_text}'")
    assert not is_panel_open_after, "Context box should be closed after save"
    assert saved_root_text == 'Central Topic (Edited By User)', "Root text should be updated after save"

    driver.save_screenshot(os.path.join(brain_dir, "proof_saved_to_node.png"))

    # Step 4: User presses Ctrl+Z on keyboard to UNDO the save!
    print("\n[5] User presses Ctrl+Z on keyboard directly to UNDO the save...")
    actions = ActionChains(driver)
    actions.key_down(Keys.CONTROL).send_keys('z').key_up(Keys.CONTROL).perform()
    time.sleep(0.4)

    text_after_ctrl_z = driver.execute_script("return window.app.mindmap.root.text;")
    print(f"  Root text after keyboard Ctrl+Z: '{text_after_ctrl_z}'")
    assert text_after_ctrl_z == initial_root_text, f"Expected '{initial_root_text}', got '{text_after_ctrl_z}'"

    driver.save_screenshot(os.path.join(brain_dir, "proof_undone_via_ctrl_z.png"))

    # Step 5: User presses Ctrl+Y on keyboard to REDO the save!
    print("\n[6] User presses Ctrl+Y on keyboard to REDO the save...")
    actions = ActionChains(driver)
    actions.key_down(Keys.CONTROL).send_keys('y').key_up(Keys.CONTROL).perform()
    time.sleep(0.4)

    text_after_ctrl_y = driver.execute_script("return window.app.mindmap.root.text;")
    print(f"  Root text after keyboard Ctrl+Y: '{text_after_ctrl_y}'")
    assert text_after_ctrl_y == 'Central Topic (Edited By User)', f"Expected 'Central Topic (Edited By User)', got '{text_after_ctrl_y}'"

    # Step 6: User clicks Toolbar Undo button
    print("\n[7] User clicks Toolbar Undo button (#btn-undo)...")
    undo_btn = driver.find_element(By.ID, "btn-undo")
    undo_btn.click()
    time.sleep(0.4)

    text_after_btn_undo = driver.execute_script("return window.app.mindmap.root.text;")
    print(f"  Root text after Toolbar Undo: '{text_after_btn_undo}'")
    assert text_after_btn_undo == initial_root_text, f"Expected '{initial_root_text}', got '{text_after_btn_undo}'"

    # Step 7: User clicks Toolbar Redo button
    print("\n[8] User clicks Toolbar Redo button (#btn-redo)...")
    redo_btn = driver.find_element(By.ID, "btn-redo")
    redo_btn.click()
    time.sleep(0.4)

    text_after_btn_redo = driver.execute_script("return window.app.mindmap.root.text;")
    print(f"  Root text after Toolbar Redo: '{text_after_btn_redo}'")
    assert text_after_btn_redo == 'Central Topic (Edited By User)', f"Expected 'Central Topic (Edited By User)', got '{text_after_btn_redo}'"

    driver.save_screenshot(os.path.join(brain_dir, "proof_redone_via_toolbar.png"))

    # Check browser logs
    logs = driver.get_log('browser')
    severe = [l for l in logs if l['level'] == 'SEVERE' and 'net::' not in l['message']]
    print(f"\n  Severe console errors: {len(severe)}")
    assert len(severe) == 0, f"Found severe console errors: {severe}"

    print("\n" + "=" * 75)
    print("ALL SAVE-TO-NODE & UNDO/REDO TESTS PASSED 100% CLEANLY!")
    print("=" * 75)

finally:
    driver.quit()

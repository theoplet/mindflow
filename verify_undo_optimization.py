import time
import os
import sys
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys

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
    print("VERIFYING ADVANCED UNDO / REDO OPTIMIZATION (CONTEXT BOX + GLOBAL STACK)")
    print("=" * 75)

    driver.get("http://127.0.0.1:3000/")

    # Wait for app boot
    for _ in range(50):
        if driver.execute_script("return !!(window.app && window.app.mindmap && window.app.mindmap.root);"):
            break
        time.sleep(0.2)

    # Initial state check
    can_undo_init = driver.execute_script("return window.app.history.canUndo();")
    print(f"[1] Initial map canUndo: {can_undo_init} (Expected: False)")
    assert can_undo_init is False, "Initial map should not have undo states"

    undo_btn = driver.find_element(By.ID, "btn-undo")
    redo_btn = driver.find_element(By.ID, "btn-redo")
    print(f"  Toolbar Undo button disabled: {undo_btn.get_attribute('disabled') is not None}")
    print(f"  Toolbar Redo button disabled: {redo_btn.get_attribute('disabled') is not None}")

    # ==================== TEST 1: CONTEXT BOX LOCAL UNDO/REDO ====================
    print("\n[2] Testing Context Box Local Undo/Redo...")
    root_id = driver.execute_script("return window.app.mindmap.root.id;")
    driver.execute_script("window.app.openRightEditorPanel(window.app.mindmap.root.id);")
    time.sleep(0.3)

    content_el = driver.find_element(By.ID, "right-editor-content")
    local_undo_btn = driver.find_element(By.ID, "right-fmt-undo")
    local_redo_btn = driver.find_element(By.ID, "right-fmt-redo")

    print(f"  Local Undo button initially disabled: {local_undo_btn.get_attribute('disabled') is not None}")
    assert local_undo_btn.get_attribute('disabled') is not None, "Local undo should be disabled initially"

    # Step 1: Type First Edit
    driver.execute_script("""
        const content = document.getElementById('right-editor-content');
        content.innerHTML = 'Central Topic (Version 1)';
        window.app.saveRightEditorLocalState();
    """)
    time.sleep(0.2)

    print(f"  After Version 1, Local Undo enabled: {local_undo_btn.get_attribute('disabled') is None}")
    assert local_undo_btn.get_attribute('disabled') is None, "Local undo should be enabled after typing"

    # Step 2: Type Second Edit
    driver.execute_script("""
        const content = document.getElementById('right-editor-content');
        content.innerHTML = 'Central Topic (Version 2 Final)';
        window.app.saveRightEditorLocalState();
    """)
    time.sleep(0.2)

    text_v2 = driver.execute_script("return document.getElementById('right-editor-content').innerHTML;")
    print(f"  Current text in editor: '{text_v2}'")

    # Step 3: Undo locally inside context box -> Should return to Version 1
    local_undo_btn.click()
    time.sleep(0.2)
    text_after_undo = driver.execute_script("return document.getElementById('right-editor-content').innerHTML;")
    print(f"  After 1st Local Undo: '{text_after_undo}'")
    assert text_after_undo == 'Central Topic (Version 1)', f"Expected 'Central Topic (Version 1)', got '{text_after_undo}'"

    # Step 4: Redo locally inside context box -> Should return to Version 2 Final
    local_redo_btn.click()
    time.sleep(0.2)
    text_after_redo = driver.execute_script("return document.getElementById('right-editor-content').innerHTML;")
    print(f"  After Local Redo: '{text_after_redo}'")
    assert text_after_redo == 'Central Topic (Version 2 Final)', f"Expected 'Central Topic (Version 2 Final)', got '{text_after_redo}'"

    driver.save_screenshot(os.path.join(brain_dir, "proof_undo_context_box.png"))

    # Step 5: Click '✨ Lưu Vào Node (Auto-Fit)'
    print("\n[3] Saving from Context Box to Node...")
    apply_btn = driver.find_element(By.ID, "btn-apply-right-editor")
    apply_btn.click()
    time.sleep(0.4)

    # Check text on root node
    root_text = driver.execute_script("return window.app.mindmap.root.text;")
    print(f"  Root text after save: '{root_text}'")
    assert root_text == 'Central Topic (Version 2 Final)', f"Expected 'Central Topic (Version 2 Final)', got '{root_text}'"

    # Check Global Undo state count
    undo_count = driver.execute_script("return window.app.history.undoStack.length;")
    print(f"  Global Undo stack count after 1 save: {undo_count} (Expected: 1)")
    assert undo_count == 1, f"Expected exactly 1 global snapshot, got {undo_count}"

    # ==================== TEST 2: GLOBAL MINDMAP UNDO/REDO ====================
    print("\n[4] Testing Global Mindmap Undo/Redo on Canvas...")
    # Click global Undo on toolbar
    undo_btn.click()
    time.sleep(0.3)

    root_text_undone = driver.execute_script("return window.app.mindmap.root.text;")
    print(f"  Root text after Global Undo: '{root_text_undone}'")
    assert root_text_undone == 'Central Topic', f"Expected 'Central Topic', got '{root_text_undone}'"

    # Click global Redo on toolbar
    redo_btn.click()
    time.sleep(0.3)

    root_text_redone = driver.execute_script("return window.app.mindmap.root.text;")
    print(f"  Root text after Global Redo: '{root_text_redone}'")
    assert root_text_redone == 'Central Topic (Version 2 Final)', f"Expected 'Central Topic (Version 2 Final)', got '{root_text_redone}'"

    # ==================== TEST 3: HIGH-SPEED MULTI-STEP CONTINUOUS UNDO ====================
    print("\n[5] Testing High-Speed Multi-Step Continuous Undo/Redo...")
    initial_children_count = driver.execute_script("return window.app.mindmap.root.children.length;")
    print(f"  Initial children count before adding branches: {initial_children_count}")

    # Create 3 child branches sequentially
    driver.execute_script("""
        const root = window.app.mindmap.root;
        window.app.mindmap.addChild(root.id, 'Branch Alpha');
        window.app.mindmap.addChild(root.id, 'Branch Beta');
        window.app.mindmap.addChild(root.id, 'Branch Gamma');
    """)
    time.sleep(0.3)

    child_count = driver.execute_script("return window.app.mindmap.root.children.length;")
    print(f"  Children count before multi-undo: {child_count}")
    assert child_count == initial_children_count + 3, f"Expected {initial_children_count + 3} children, got {child_count}"

    # Rapidly undo 3 times in quick succession (no artificial 100ms lock!)
    driver.execute_script("""
        window.app.undo();
        window.app.undo();
        window.app.undo();
    """)
    time.sleep(0.3)

    child_count_after_undo = driver.execute_script("return window.app.mindmap.root.children.length;")
    print(f"  Children count after 3 rapid undos: {child_count_after_undo} (Expected: {initial_children_count})")
    assert child_count_after_undo == initial_children_count, f"Expected {initial_children_count} children after 3 undos, got {child_count_after_undo}"

    # Rapidly redo 3 times in quick succession
    driver.execute_script("""
        window.app.redo();
        window.app.redo();
        window.app.redo();
    """)
    time.sleep(0.3)

    child_count_after_redo = driver.execute_script("return window.app.mindmap.root.children.length;")
    child_names = driver.execute_script("return window.app.mindmap.root.children.map(c => c.text);")
    print(f"  Children count after 3 rapid redos: {child_count_after_redo}")
    print(f"  All branches: {child_names}")
    assert child_count_after_redo == initial_children_count + 3, f"Expected {initial_children_count + 3} children after 3 redos, got {child_count_after_redo}"
    assert 'Branch Alpha' in child_names and 'Branch Beta' in child_names and 'Branch Gamma' in child_names

    # Screenshot
    driver.save_screenshot(os.path.join(brain_dir, "proof_undo_redo_rapid_success.png"))

    # Check browser logs
    logs = driver.get_log('browser')
    severe = [l for l in logs if l['level'] == 'SEVERE' and 'net::' not in l['message']]
    print(f"\n  Severe console errors: {len(severe)}")
    assert len(severe) == 0, f"Found severe console errors: {severe}"

    print("\n" + "=" * 75)
    print("ALL UNDO / REDO OPTIMIZATION TESTS PASSED CLEANLY WITH 0 ERRORS! (100%)")
    print("=" * 75)

finally:
    driver.quit()

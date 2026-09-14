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
    print("VERIFYING CONTEXT BOX RE-OPEN UNDO PERSISTENCE ACROSS SAVES")
    print("=" * 75)

    driver.get("http://127.0.0.1:3000/")

    # Wait for app boot
    for _ in range(50):
        if driver.execute_script("return !!(window.app && window.app.mindmap && window.app.mindmap.root);"):
            break
        time.sleep(0.2)

    root_id = driver.execute_script("return window.app.mindmap.root.id;")
    initial_text = driver.execute_script("return window.app.mindmap.root.text;")
    print(f"[1] Initial node text: '{initial_text}'")

    # ==================== SESSION 1: USER MAKES EDITS AND SAVES ====================
    print("\n[2] Session 1: User opens Context Box, types wrong edits + adds image, and saves...")
    driver.execute_script("window.app.openRightEditorPanel(window.app.mindmap.root.id);")
    time.sleep(0.3)

    # User types mistake and adds an image
    driver.execute_script("""
        const content = document.getElementById('right-editor-content');
        content.innerHTML = 'Central Topic (Accidental Mistake Text)';
        window.app.rightEditorImages.push({ src: 'data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"50\" height=\"50\"><rect width=\"50\" height=\"50\" fill=\"red\"/></svg>', width: 100, height: 100 });
        window.app.renderRightEditorImages();
        window.app.saveRightEditorLocalState();
    """)
    time.sleep(0.2)

    # Click '✨ Lưu Vào Node (Auto-Fit)'
    apply_btn = driver.find_element(By.ID, "btn-apply-right-editor")
    apply_btn.click()
    time.sleep(0.4)

    saved_text = driver.execute_script("return window.app.mindmap.root.text;")
    saved_images_count = driver.execute_script("return (window.app.mindmap.root.images || []).length;")
    print(f"  Saved to node on canvas -> Text: '{saved_text}', Images count: {saved_images_count}")
    assert saved_text == 'Central Topic (Accidental Mistake Text)', "Node text not updated on canvas"
    assert saved_images_count == 1, "Node image not updated on canvas"

    # ==================== SESSION 2: USER RE-OPENS CONTEXT BOX AND UNDOES ====================
    print("\n[3] Session 2: User realizes mistake, RE-OPENS Context Box on the same node...")
    driver.execute_script("window.app.openRightEditorPanel(window.app.mindmap.root.id);")
    time.sleep(0.3)

    local_undo_btn = driver.find_element(By.ID, "right-fmt-undo")
    local_redo_btn = driver.find_element(By.ID, "right-fmt-redo")

    is_undo_enabled = local_undo_btn.get_attribute("disabled") is None
    print(f"  Context Box Re-opened -> Local Undo button enabled: {is_undo_enabled} (Expected: True)")
    assert is_undo_enabled, "Local Undo button MUST be enabled after reopening a previously edited node!"

    driver.save_screenshot(os.path.join(brain_dir, "proof_reopen_context_box_with_undo_enabled.png"))

    # Step: User clicks Local Undo (↩) inside Context Box!
    print("\n[4] User clicks Local Undo (↩) inside Context Box...")
    local_undo_btn.click()
    time.sleep(0.3)

    content_after_undo = driver.execute_script("return document.getElementById('right-editor-content').innerHTML;")
    images_after_undo = driver.execute_script("return window.app.rightEditorImages.length;")
    print(f"  Editor text after 1st Local Undo: '{content_after_undo}'")
    print(f"  Editor images count after 1st Local Undo: {images_after_undo}")

    assert content_after_undo == initial_text, f"Expected '{initial_text}', got '{content_after_undo}'"
    assert images_after_undo == 0, f"Expected 0 images after undo, got {images_after_undo}"

    driver.save_screenshot(os.path.join(brain_dir, "proof_undone_inside_reopened_box.png"))

    # Step: User clicks Save to Node to persist the clean restored state!
    print("\n[5] User clicks '✨ Lưu Vào Node (Auto-Fit)' to persist restored state...")
    apply_btn = driver.find_element(By.ID, "btn-apply-right-editor")
    driver.execute_script("arguments[0].click();", apply_btn)
    time.sleep(0.4)

    final_canvas_text = driver.execute_script("return window.app.mindmap.root.text;")
    final_canvas_images = driver.execute_script("return (window.app.mindmap.root.images || []).length;")
    print(f"  Final Node on MindMap canvas -> Text: '{final_canvas_text}', Images: {final_canvas_images}")
    assert final_canvas_text == initial_text, f"Expected '{initial_text}', got '{final_canvas_text}'"
    assert final_canvas_images == 0, f"Expected 0 images, got {final_canvas_images}"

    driver.save_screenshot(os.path.join(brain_dir, "proof_final_clean_mindmap_canvas.png"))

    # Check browser logs
    logs = driver.get_log('browser')
    severe = [l for l in logs if l['level'] == 'SEVERE' and 'net::' not in l['message']]
    print(f"\n  Severe console errors: {len(severe)}")
    assert len(severe) == 0, f"Found severe console errors: {severe}"

    print("\n" + "=" * 75)
    print("ALL RE-OPEN CONTEXT BOX UNDO PERSISTENCE TESTS PASSED (100%)!")
    print("=" * 75)

finally:
    driver.quit()

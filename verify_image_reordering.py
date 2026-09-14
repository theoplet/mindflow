import time
import os
import sys
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By

sys.stdout.reconfigure(encoding='utf-8')

options = webdriver.ChromeOptions()
options.add_argument('--headless=new')
options.add_argument('--window-size=1600,1000')
options.set_capability('goog:loggingPrefs', {'browser': 'ALL'})

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
brain_dir = r"C:\Users\ADMIN\.gemini\antigravity-ide\brain\ee8d6404-2caf-4d3b-972e-9a14efebf4a9"
os.makedirs(brain_dir, exist_ok=True)

try:
    print("=" * 70)
    print("VERIFYING IMAGE REORDERING IN CONTEXT BOX (RIGHT EDITOR PANEL)")
    print("=" * 70)

    driver.get("http://127.0.0.1:3000/")

    # Wait for app boot
    for _ in range(50):
        if driver.execute_script("return !!(window.app && window.app.mindmap && window.app.mindmap.root);"):
            break
        time.sleep(0.2)

    print("[1] Opening Right Editor Panel for root node...")
    # Inject 3 sample images with distinct colored SVG data URLs
    img_red = "data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'70\'><rect width=\'100\' height=\'70\' fill=\'%23EF4444\'/><text x=\'50\' y=\'42\' font-size=\'18\' font-weight=\'bold\' fill=\'white\' text-anchor=\'middle\'>RED</text></svg>"
    img_green = "data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'70\'><rect width=\'100\' height=\'70\' fill=\'%2310B981\'/><text x=\'50\' y=\'42\' font-size=\'18\' font-weight=\'bold\' fill=\'white\' text-anchor=\'middle\'>GREEN</text></svg>"
    img_blue = "data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'70\'><rect width=\'100\' height=\'70\' fill=\'%233B82F6\'/><text x=\'50\' y=\'42\' font-size=\'18\' font-weight=\'bold\' fill=\'white\' text-anchor=\'middle\'>BLUE</text></svg>"

    driver.execute_script(f"""
        const root = window.app.mindmap.root;
        window.app.openRightEditorPanel(root.id);
        window.app.rightEditorImages = [
            {{ src: "{img_red}", width: 160, height: 100 }},
            {{ src: "{img_green}", width: 160, height: 100 }},
            {{ src: "{img_blue}", width: 160, height: 100 }}
        ];
        window.app.renderRightEditorImages();
    """)
    time.sleep(0.5)

    # Check gallery items count
    thumbs = driver.find_elements(By.CLASS_NAME, "right-img-thumb")
    print(f"  Rendered thumbnails count: {len(thumbs)}")
    assert len(thumbs) == 3, f"Expected 3 thumbnails, got {len(thumbs)}"

    # Check order badges
    badges = [b.text for b in driver.find_elements(By.CLASS_NAME, "right-img-order-badge")]
    print(f"  Order badges: {badges}")
    assert badges == ['#1', '#2', '#3'], f"Badges incorrect: {badges}"

    # Take screenshot of initial state
    driver.save_screenshot(os.path.join(brain_dir, "step1_initial_images_ordered.png"))
    print("  Saved step1_initial_images_ordered.png")

    # [2] Test Move Right on Image 1 (Red -> moves to index 1)
    print("\n[2] Testing Move Right on Image #1 (Red)...")
    first_thumb_move_right = thumbs[0].find_elements(By.CLASS_NAME, "right-img-move-btn")[1] # 0 is left, 1 is right
    first_thumb_move_right.click()
    time.sleep(0.3)

    # Check new image order
    new_order = driver.execute_script("""
        return window.app.rightEditorImages.map(img => img.src.includes('EF4444') ? 'RED' : (img.src.includes('10B981') ? 'GREEN' : 'BLUE'));
    """)
    print(f"  Order after moving Red to right: {new_order}")
    assert new_order == ['GREEN', 'RED', 'BLUE'], f"Expected ['GREEN', 'RED', 'BLUE'], got {new_order}"

    # [3] Test Move Left on Image 3 (Blue -> moves to index 1)
    print("\n[3] Testing Move Left on Image #3 (Blue)...")
    thumbs = driver.find_elements(By.CLASS_NAME, "right-img-thumb")
    third_thumb_move_left = thumbs[2].find_elements(By.CLASS_NAME, "right-img-move-btn")[0]
    third_thumb_move_left.click()
    time.sleep(0.3)

    new_order = driver.execute_script("""
        return window.app.rightEditorImages.map(img => img.src.includes('EF4444') ? 'RED' : (img.src.includes('10B981') ? 'GREEN' : 'BLUE'));
    """)
    print(f"  Order after moving Blue to left: {new_order}")
    assert new_order == ['GREEN', 'BLUE', 'RED'], f"Expected ['GREEN', 'BLUE', 'RED'], got {new_order}"

    # [4] Test Drag & Drop reorder via JS drop event
    print("\n[4] Testing Drag and Drop reorder (Drag RED from index 2 to index 0)...")
    driver.execute_script("""
        const gallery = document.getElementById('right-images-gallery');
        const thumbs = gallery.querySelectorAll('.right-img-thumb');
        
        // Simulate drag from index 2 to index 0
        const dataTransfer = new DataTransfer();
        dataTransfer.setData('text/plain', '2');
        
        const dropEvent = new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
            dataTransfer: dataTransfer
        });
        thumbs[0].dispatchEvent(dropEvent);
    """)
    time.sleep(0.3)

    new_order = driver.execute_script("""
        return window.app.rightEditorImages.map(img => img.src.includes('EF4444') ? 'RED' : (img.src.includes('10B981') ? 'GREEN' : 'BLUE'));
    """)
    print(f"  Order after drag & drop: {new_order}")
    assert new_order == ['RED', 'GREEN', 'BLUE'], f"Expected ['RED', 'GREEN', 'BLUE'], got {new_order}"

    # Take screenshot of Right Editor Panel with controls
    driver.save_screenshot(os.path.join(brain_dir, "step2_editor_panel_reordered.png"))
    print("  Saved step2_editor_panel_reordered.png")

    # [5] Save to Node and Verify Canvas Rendering
    print("\n[5] Clicking Save to Node (Auto-Fit)...")
    apply_btn = driver.find_element(By.ID, "btn-apply-right-editor")
    apply_btn.click()
    time.sleep(0.5)

    # Check node in mindmap
    node_images = driver.execute_script("""
        const root = window.app.mindmap.root;
        return (root.images || []).map(img => img.src.includes('EF4444') ? 'RED' : (img.src.includes('10B981') ? 'GREEN' : 'BLUE'));
    """)
    print(f"  Node.images on Mindmap root: {node_images}")
    assert node_images == ['RED', 'GREEN', 'BLUE'], f"Expected ['RED', 'GREEN', 'BLUE'], got {node_images}"

    # Verify DOM elements on canvas
    rendered_dom_images = driver.execute_script("""
        const rootEl = document.querySelector('.root-node');
        const imgs = rootEl.querySelectorAll('.node-image-item');
        return Array.from(imgs).map(img => img.src.includes('EF4444') ? 'RED' : (img.src.includes('10B981') ? 'GREEN' : 'BLUE'));
    """)
    print(f"  Rendered images on canvas: {rendered_dom_images}")
    assert rendered_dom_images == ['RED', 'GREEN', 'BLUE'], f"Expected ['RED', 'GREEN', 'BLUE'], got {rendered_dom_images}"

    # Take screenshot of canvas with images
    driver.save_screenshot(os.path.join(brain_dir, "step3_mindmap_canvas_rendered.png"))
    print("  Saved step3_mindmap_canvas_rendered.png")

    # Check browser logs for errors
    logs = driver.get_log('browser')
    severe = [l for l in logs if l['level'] == 'SEVERE' and 'net::' not in l['message']]
    print(f"  Severe console errors: {len(severe)}")
    assert len(severe) == 0, f"Found severe console errors: {severe}"

    print("\n" + "=" * 70)
    print("ALL IMAGE REORDERING TESTS PASSED SUCCESSFULLY! (100% CLEAN)")
    print("=" * 70)

finally:
    driver.quit()

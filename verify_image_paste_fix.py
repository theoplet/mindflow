import time
import os
import sys
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

sys.stdout.reconfigure(encoding='utf-8')

options = webdriver.ChromeOptions()
options.add_argument('--headless=new')
options.add_argument('--window-size=1600,1000')
options.set_capability('goog:loggingPrefs', {'browser': 'ALL'})

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

try:
    print("=" * 70)
    print("VERIFYING FIX: IMAGE PASTE NO LONGER CAUSES INFINITE NODE GROWTH")
    print("=" * 70)

    driver.get("http://127.0.0.1:3000/")
    for _ in range(50):
        if driver.execute_script("return !!(window.app && window.app.mindmap && window.app.mindmap.root);"):
            break
        time.sleep(0.2)

    # 1. Test paste with 300KB Base64 data URL in node.text
    print("\n[1] Testing node.text with 300KB Base64 image...")
    res1 = driver.execute_script("""
        const root = window.app.mindmap.root;
        const b64 = 'data:image/png;base64,' + 'A'.repeat(300000);
        window.app.mindmap.updateNode(root.id, {
            text: 'Topic with image <img src="' + b64 + '">'
        });
        window.app.renderMap();
        const el = window.app.renderer.nodeElements.get(root.id);
        return {
            offsetWidth: el.offsetWidth,
            offsetHeight: el.offsetHeight,
            minHeight: parseInt(el.style.minHeight) || 0
        };
    """)
    print(f"  Result: {res1}")
    assert res1['offsetHeight'] < 500, f"Node height must be < 500px, got {res1['offsetHeight']}"
    assert res1['offsetWidth'] < 600, f"Node width must be < 600px, got {res1['offsetWidth']}"
    print("  [PASS] Node dimensions stayed compact and bounded!")

    # 2. Test paste image into Right Editor panel and Apply
    print("\n[2] Testing Right Editor paste image & Apply...")
    driver.execute_script("""
        const root = window.app.mindmap.root;
        const child = root.children && root.children.length > 0 ? root.children[0] : root;
        window.app.openRightEditorPanel(child.id);
        const contentEl = document.getElementById('right-editor-content');
        
        const dt = new DataTransfer();
        const b64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAACWCAYAAABkW7XSAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAI6SURBVHhe7cExAQAAAMKg9U9tCF8gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgIsBIswAATWvV/8AAAAASUVORK5CYII=';
        const byteString = atob(b64.split(',')[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        const blob = new Blob([ab], { type: 'image/png' });
        const file = new File([blob], 'paste.png', { type: 'image/png' });
        dt.items.add(file);
        
        const pasteEvent = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: dt
        });
        contentEl.dispatchEvent(pasteEvent);
    """)
    time.sleep(0.5)

    res2 = driver.execute_script("""
        window.app.applyRightEditorToNode(false);
        const root = window.app.mindmap.root;
        const child = root.children && root.children.length > 0 ? root.children[0] : root;
        const childEl = window.app.renderer.nodeElements.get(child.id);
        return {
            offsetWidth: childEl.offsetWidth,
            offsetHeight: childEl.offsetHeight,
            minHeight: parseInt(childEl.style.minHeight) || 0
        };
    """)
    print(f"  Result: {res2}")
    assert res2['offsetHeight'] < 400, f"Child node height must be < 400px, got {res2['offsetHeight']}"
    assert res2['offsetWidth'] < 500, f"Child node width must be < 500px, got {res2['offsetWidth']}"
    print("  [PASS] Right editor image paste applied with clean, compact dimensions!")

    # 3. Test global canvas Ctrl+V paste on selected node
    print("\n[3] Testing Canvas Ctrl+V paste on selected node...")
    driver.execute_script("""
        const root = window.app.mindmap.root;
        window.app.mindmap.selectNode(root.id);
        
        const dt = new DataTransfer();
        const b64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        const byteString = atob(b64.split(',')[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        const blob = new Blob([ab], { type: 'image/png' });
        const file = new File([blob], 'pasted_node.png', { type: 'image/png' });
        dt.items.add(file);
        
        const pasteEvent = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: dt
        });
        document.dispatchEvent(pasteEvent);
    """)
    time.sleep(0.5)

    res3 = driver.execute_script("""
        const root = window.app.mindmap.root;
        const rootEl = window.app.renderer.nodeElements.get(root.id);
        return {
            imagesCount: (root.images || []).length,
            offsetWidth: rootEl.offsetWidth,
            offsetHeight: rootEl.offsetHeight
        };
    """)
    print(f"  Result: {res3}")
    assert res3['offsetHeight'] < 500, f"Root height must be < 500px, got {res3['offsetHeight']}"
    print("  [PASS] Canvas paste added image to node cleanly without blowout!")

    # 4. Check console errors
    logs = driver.get_log('browser')
    severe = [l for l in logs if l['level'] == 'SEVERE' and 'net::' not in l['message']]
    assert len(severe) == 0, f"Found severe errors: {severe}"
    print("\n[4] Zero browser console errors!")

    print("\n" + "=" * 70)
    print("ALL TESTS PASSED! INFINITE NODE SIZE BUG IS COMPLETELY RESOLVED!")
    print("=" * 70)

finally:
    driver.quit()

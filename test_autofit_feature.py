import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By

def run_test():
    chrome_options = Options()
    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    driver = webdriver.Chrome(options=chrome_options)
    
    try:
        driver.get("http://localhost:3000")
        time.sleep(1.5)
        
        # 1. Verify buttons exist
        save_btn = driver.find_element(By.ID, "btn-apply-right-editor")
        autofit_btn = driver.find_element(By.ID, "btn-autofit-right-editor")
        assert save_btn is not None, "Save button missing"
        assert autofit_btn is not None, "Auto-Fit button missing"
        print("[PASS] Both '#btn-apply-right-editor' and '#btn-autofit-right-editor' buttons exist")
        
        # 2. Set custom dimensions on root node
        driver.execute_script("""
            const root = window.app.mindmap.root;
            window.app.mindmap.updateNode(root.id, {
                customWidth: 320,
                customHeight: 160
            });
            window.app.renderMap();
        """)
        
        has_custom = driver.execute_script("""
            const root = window.app.mindmap.root;
            return root.customWidth === 320 && root.customHeight === 160;
        """)
        assert has_custom, "Failed to set custom dimensions"
        print("[PASS] Set customWidth: 320, customHeight: 160 on root node")
        
        # 3. Test 'Save to Node' WITHOUT Auto-Fit (preserves custom dimensions)
        driver.execute_script("""
            const root = window.app.mindmap.root;
            window.app.openRightEditorPanel(root.id);
            const contentEl = document.getElementById('right-editor-content');
            contentEl.innerHTML = 'Saved Without AutoFit';
            // Click Save button (applyRightEditorToNode(false))
            document.getElementById('btn-apply-right-editor').click();
        """)
        time.sleep(0.5)
        
        dims_preserved = driver.execute_script("""
            const root = window.app.mindmap.root;
            return {
                text: root.text,
                customWidth: root.customWidth,
                customHeight: root.customHeight
            };
        """)
        assert dims_preserved['text'] == 'Saved Without AutoFit', f"Unexpected text: {dims_preserved['text']}"
        assert dims_preserved['customWidth'] == 320, f"Expected 320, got {dims_preserved['customWidth']}"
        assert dims_preserved['customHeight'] == 160, f"Expected 160, got {dims_preserved['customHeight']}"
        print(f"[PASS] Save button preserved manual resize dimensions: {dims_preserved}")
        
        # 4. Test 'Auto-Fit' button in Right Editor Panel (clears custom dimensions)
        driver.execute_script("""
            const root = window.app.mindmap.root;
            window.app.openRightEditorPanel(root.id);
            const contentEl = document.getElementById('right-editor-content');
            contentEl.innerHTML = 'Saved With AutoFit';
            // Click Auto-Fit button (applyRightEditorToNode(true))
            document.getElementById('btn-autofit-right-editor').click();
        """)
        time.sleep(0.5)
        
        dims_cleared = driver.execute_script("""
            const root = window.app.mindmap.root;
            return {
                text: root.text,
                customWidth: root.customWidth,
                customHeight: root.customHeight
            };
        """)
        assert dims_cleared['text'] == 'Saved With AutoFit', f"Unexpected text: {dims_cleared['text']}"
        assert dims_cleared['customWidth'] is None, f"Expected None, got {dims_cleared['customWidth']}"
        assert dims_cleared['customHeight'] is None, f"Expected None, got {dims_cleared['customHeight']}"
        print(f"[PASS] Auto-Fit button cleared custom dimensions: {dims_cleared}")
        
        # 5. Test context menu auto-fit feature
        driver.execute_script("""
            const root = window.app.mindmap.root;
            window.app.mindmap.updateNode(root.id, {
                customWidth: 400,
                customHeight: 250
            });
            window.app.renderMap();
        """)
        # Trigger context menu action 'autofitNode'
        driver.execute_script("""
            const root = window.app.mindmap.root;
            window.app.mindmap.selectNode(root.id);
            window.app.autofitNode(root.id);
        """)
        time.sleep(0.5)
        
        ctx_cleared = driver.execute_script("""
            const root = window.app.mindmap.root;
            return {
                customWidth: root.customWidth,
                customHeight: root.customHeight
            };
        """)
        assert ctx_cleared['customWidth'] is None, f"Expected None, got {ctx_cleared['customWidth']}"
        assert ctx_cleared['customHeight'] is None, f"Expected None, got {ctx_cleared['customHeight']}"
        print(f"[PASS] Context menu autofitNode cleared custom dimensions: {ctx_cleared}")
        
        # 6. Check console errors
        logs = driver.get_log("browser")
        severe_errors = [l for l in logs if l['level'] == 'SEVERE']
        assert len(severe_errors) == 0, f"Severe console errors found: {severe_errors}"
        print("[PASS] Zero browser console errors")
        
        print("\n=======================================================")
        print("ALL AUTO-FIT TESTS PASSED SUCCESSFULLY!")
        print("=======================================================")
    finally:
        driver.quit()

if __name__ == '__main__':
    run_test()

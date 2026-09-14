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
    print("MINDFLOW COMPREHENSIVE STORAGE METHOD ALIASES AUDIT TEST (v82.0)")
    print("=" * 70)

    driver.get("http://127.0.0.1:3000/")
    map1_id = None
    for _ in range(50):
        try:
            val = driver.execute_script("return (window.app && window.app.mindmap && window.app.mindmap.root) ? window.app.currentMapId : null;")
            if val:
                map1_id = val
                break
        except Exception:
            pass
        time.sleep(0.3)

    assert map1_id is not None, "App failed to initialize!"
    print(f"Initial Map initialized with Map ID: {map1_id}")

    brain_dir = r"C:\Users\ADMIN\.gemini\antigravity\brain\bd98c8bb-de61-4e22-bbab-a309594e8dff"

    # Audit all 11 aliases on window.storage and window.app.storage
    alias_results = driver.execute_script("""
        const s = window.storage || (window.app ? window.app.storage : null);
        return {
            hasWindowStorage: Boolean(window.storage),
            hasWindowMindmap: Boolean(window.mindmap),
            getMap: typeof s.getMap === 'function',
            getMapAsync: typeof s.getMapAsync === 'function',
            get: typeof s.get === 'function',
            getAsync: typeof s.getAsync === 'function',
            save: typeof s.save === 'function',
            delete: typeof s.delete === 'function',
            removeMap: typeof s.removeMap === 'function',
            getMaps: typeof s.getMaps === 'function',
            getMapsAsync: typeof s.getMapsAsync === 'function',
            listMaps: typeof s.listMaps === 'function',
            listMapsAsync: typeof s.listMapsAsync === 'function'
        };
    """)

    print(f"Storage aliases audit results: {alias_results}")

    for k, v in alias_results.items():
        assert v is True, f"Failed storage alias test for '{k}'!"

    print("[PASS] All 11 Storage method aliases & global window references verified 100% cleanly!")
    driver.save_screenshot(os.path.join(brain_dir, 'proof_38_all_storage_alias_methods_verified.png'))

    # Check browser logs for severe JS errors (exclude external CDN network offline logs)
    logs = driver.get_log('browser')
    severe_js_errors = [log for log in logs if log['level'] == 'SEVERE' and 'net::' not in log['message']]
    print(f"Severe JS console errors count: {len(severe_js_errors)}")
    assert len(severe_js_errors) == 0, f"Found severe JS console errors: {severe_js_errors}"

    print("\n[SUCCESS] COMPREHENSIVE STORAGE METHOD ALIASES AUDIT PASSED CLEANLY WITH 0 ERRORS!")

finally:
    driver.quit()

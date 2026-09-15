import json
import time
import sys
import urllib.parse
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By

sys.stdout.reconfigure(encoding='utf-8')

def create_driver():
    options = webdriver.ChromeOptions()
    options.add_argument('--headless=new')
    options.add_argument('--window-size=1600,1000')
    options.set_capability('goog:loggingPrefs', {'browser': 'ALL'})
    return webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

def check_severe_logs(driver, context_name):
    logs = driver.get_log('browser')
    severe_errors = [log for log in logs if log.get('level') == 'SEVERE']
    print(f"   [{context_name}] Total console logs: {len(logs)}, SEVERE errors: {len(severe_errors)}")
    for err in severe_errors:
        print(f"      [SEVERE] {err.get('message')}")
    assert len(severe_errors) == 0, f"Found {len(severe_errors)} SEVERE errors in {context_name}: {severe_errors}"

def run_tests():
    driver = create_driver()
    try:
        print("=" * 70)
        print("GOOGLE DRIVE UI INTEGRATION ('OPEN WITH' & 'NEW') TEST SUITE")
        print("=" * 70)

        # -------------------------------------------------------------
        # 1. TEST DIRECT FUNCTION PARSING IN BROWSER CONTEXT
        # -------------------------------------------------------------
        print("\n[TEST 1] Testing parseDriveState & clearDriveState in browser...")
        driver.get("http://127.0.0.1:3000/index.html")
        time.sleep(1)

        test_state_payload = {
            "ids": ["test-file-999"],
            "resourceKeys": {"test-file-999": "rk-secret-key"},
            "action": "open",
            "userId": "100234567"
        }
        encoded_json = urllib.parse.quote(json.dumps(test_state_payload))
        
        parsed_result = driver.execute_script(f"""
            import('/js/drive_state.js').then(m => window.__testModule = m);
        """)
        time.sleep(0.5)

        eval_result = driver.execute_script(f"""
            const m = window.__testModule;
            const query = '?state={encoded_json}';
            return m.parseDriveState(query);
        """)

        print(f"   Parsed state output: {eval_result}")
        assert eval_result is not None, "parseDriveState returned null"
        assert eval_result["action"] == "open", f"Expected action 'open', got {eval_result.get('action')}"
        assert eval_result["ids"] == ["test-file-999"], f"Expected ids ['test-file-999'], got {eval_result.get('ids')}"
        assert eval_result["resourceKeys"]["test-file-999"] == "rk-secret-key", "resourceKeys mismatch"
        assert eval_result["userId"] == "100234567", "userId mismatch"
        print("   -> parseDriveState unit verification: PASSED")

        # -------------------------------------------------------------
        # 2. TEST SIMULATED /open?state=... URL
        # -------------------------------------------------------------
        print("\n[TEST 2] Navigating to /open?state=<encoded JSON>...")
        open_state = {
            "ids": ["mock-drive-doc-001"],
            "resourceKeys": {"mock-drive-doc-001": "rk-drive-001"},
            "action": "open",
            "userId": "test-user-oauth"
        }
        open_url = f"http://127.0.0.1:3000/open?state={urllib.parse.quote(json.dumps(open_state))}"
        print(f"   URL: {open_url}")
        driver.get(open_url)

        # Wait for app to initialize
        for _ in range(30):
            ready = driver.execute_script("return !!(window.app && window.app.mindmap);")
            if ready:
                break
            time.sleep(0.2)

        app_ready = driver.execute_script("return !!(window.app && window.app.mindmap);")
        assert app_ready, "App failed to initialize on /open route"
        print("   MindFlow app successfully loaded on /open route!")

        # Verify clearDriveState removed 'state' from the browser URL
        current_url = driver.current_url
        print(f"   Current URL after handleDriveEntry: {current_url}")
        assert "state=" not in current_url, f"Expected 'state' to be stripped from URL, but got: {current_url}"
        print("   -> clearDriveState successfully cleaned URL without reload")

        # Verify NO SEVERE console errors
        check_severe_logs(driver, "Scenario: /open?state=...")
        print("   -> Console cleanliness on /open: PASSED (0 SEVERE errors)")

        # -------------------------------------------------------------
        # 3. TEST SIMULATED /new?state=... URL (Action: 'create')
        # -------------------------------------------------------------
        print("\n[TEST 3] Navigating to /new?state=<encoded JSON> (Action: 'create')...")
        create_state = {
            "action": "create",
            "folderId": "folder-destination-777",
            "userId": "test-user-oauth"
        }
        new_url = f"http://127.0.0.1:3000/new?state={urllib.parse.quote(json.dumps(create_state))}"
        print(f"   URL: {new_url}")
        driver.get(new_url)

        for _ in range(30):
            ready = driver.execute_script("return !!(window.app && window.app.pendingDriveFolderId);")
            if ready:
                break
            time.sleep(0.2)

        pending_folder = driver.execute_script("return window.app.pendingDriveFolderId;")
        print(f"   window.app.pendingDriveFolderId: {pending_folder}")
        assert pending_folder == "folder-destination-777", f"Expected pending folder 'folder-destination-777', got {pending_folder}"

        current_url_new = driver.current_url
        assert "state=" not in current_url_new, f"Expected state stripped from /new URL, got: {current_url_new}"
        print("   -> Action 'create' pending folder set & URL cleaned: PASSED")

        check_severe_logs(driver, "Scenario: /new?state=...")
        print("   -> Console cleanliness on /new: PASSED (0 SEVERE errors)")

        # -------------------------------------------------------------
        # 4. TEST DEFAULT ROOT ACCESS (REGULAR LOAD - LOCALSTORAGE PRESERVED)
        # -------------------------------------------------------------
        print("\n[TEST 4] Navigating to default / without ?state=...")
        driver.get("http://127.0.0.1:3000/")
        time.sleep(0.8)

        has_root = driver.execute_script("return !!(window.app && window.app.mindmap && window.app.mindmap.root);")
        assert has_root, "Regular mindmap root failed to load from storage"
        print("   -> Local storage / normal map loading: PASSED")

        check_severe_logs(driver, "Scenario: Default /")
        print("   -> Console cleanliness on default root: PASSED (0 SEVERE errors)")

        print("\n" + "=" * 70)
        print("ALL TESTS PASSED SUCCESSFULLY WITH ZERO SEVERE CONSOLE ERRORS!")
        print("=" * 70)

    finally:
        driver.quit()

if __name__ == '__main__':
    run_tests()

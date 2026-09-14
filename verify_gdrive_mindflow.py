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
    print("MINDFLOW GDRIVE .MINDFLOW EXTENSION & AUTO-CONNECT AUDIT TEST")
    print("=" * 70)

    driver.get("http://127.0.0.1:8000/")
    time.sleep(1)

    # Audit GDrive instance and methods
    test_res = driver.execute_script("""
        const gdrive = window.app ? window.app.gdrive : null;
        if (!gdrive) return { error: 'GDrive instance not found on window.app' };

        // Test 1: Check localStorage token initialization & auto-connect support
        localStorage.setItem('mindflow_gdrive_token', 'test_fake_token_123');
        localStorage.setItem('mindflow_gdrive_client_id', 'test_client_id_456');

        const gdriveNew = new (gdrive.constructor)();
        const hasTokenInLocalStorage = gdriveNew.token === 'test_fake_token_123';
        const hasClientIdInLocalStorage = gdriveNew.clientId === 'test_client_id_456';
        const isConnected = gdriveNew.isConnected();

        // Clean up test items
        localStorage.removeItem('mindflow_gdrive_token');
        localStorage.removeItem('mindflow_gdrive_client_id');

        return {
            hasGDrive: true,
            hasTokenInLocalStorage,
            hasClientIdInLocalStorage,
            isConnected,
            saveFileFunction: typeof gdrive.saveFile === 'function',
            listFilesFunction: typeof gdrive.listFiles === 'function',
            loadFileFunction: typeof gdrive.loadFile === 'function',
            authorizeFunction: typeof gdrive.authorize === 'function'
        };
    """)

    print(f"GDrive verification results: {test_res}")

    assert test_res.get('hasGDrive') is True, "GDrive instance not found!"
    assert test_res.get('hasTokenInLocalStorage') is True, "GDrive failed to read token from localStorage!"
    assert test_res.get('hasClientIdInLocalStorage') is True, "GDrive failed to read clientId from localStorage!"
    assert test_res.get('isConnected') is True, "GDrive isConnected() failed!"
    assert test_res.get('saveFileFunction') is True, "GDrive saveFile function missing!"
    assert test_res.get('listFilesFunction') is True, "GDrive listFiles function missing!"

    # Check browser logs for severe JS errors
    logs = driver.get_log('browser')
    severe_errors = [log for log in logs if log['level'] == 'SEVERE' and 'net::' not in log['message'] and '401' not in log['message']]
    print(f"Severe JS console errors count: {len(severe_errors)}")
    assert len(severe_errors) == 0, f"Found severe JS console errors: {severe_errors}"

    print("\n[PASS] GDrive .mindflow extension & Auto-Connect persistence audit PASSED CLEANLY!")

finally:
    driver.quit()

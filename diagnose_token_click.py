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

try:
    print("=" * 70)
    print("DIAGNOSING SAVE TOKEN BUTTON CLICK")
    print("=" * 70)

    driver.get("http://127.0.0.1:8000/")
    time.sleep(1)

    import os
    token = os.environ.get("GOOGLE_ACCESS_TOKEN", "YOUR_GOOGLE_ACCESS_TOKEN_HERE")

    # Open GDrive modal
    driver.execute_script("window.app.showGDriveModal();")
    time.sleep(0.5)

    # Set token input value
    token_input = driver.find_element(By.ID, "gdrive-access-token")
    token_input.clear()
    token_input.send_keys(token)

    # Click save token button
    btn_save = driver.find_element(By.ID, "btn-save-gdrive-token")
    btn_save.click()
    time.sleep(2)

    ui_state = driver.execute_script("""
        return {
            tokenInGDrive: window.app.gdrive.token,
            isConnected: window.app.gdrive.isConnected(),
            user: window.app.gdrive.user,
            userNameEl: document.getElementById('gdrive-user-name') ? document.getElementById('gdrive-user-name').textContent : null,
            userEmailEl: document.getElementById('gdrive-user-email') ? document.getElementById('gdrive-user-email').textContent : null
        };
    """)

    print("UI State after token click:", ui_state)

    # Browser logs
    logs = driver.get_log('browser')
    print("\nBrowser Logs:")
    for log in logs:
        print(f"[{log['level']}] {log['message']}")

finally:
    driver.quit()

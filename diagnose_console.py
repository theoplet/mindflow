import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

options = webdriver.ChromeOptions()
options.add_argument('--headless=new')
options.add_argument('--window-size=1600,1000')
options.set_capability('goog:loggingPrefs', {'browser': 'ALL'})

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

try:
    driver.get("http://localhost:3000/")
    time.sleep(2)
    logs = driver.get_log('browser')
    print("ALL LOGS:")
    for l in logs:
        safe_msg = l['message'].encode('ascii', 'ignore').decode('ascii')
        print(f"  [{l['level']}] {safe_msg}")
finally:
    driver.quit()

import time
import os
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

options = webdriver.ChromeOptions()
options.add_argument('--headless=new')
options.add_argument('--window-size=1600,1000')
options.set_capability('goog:loggingPrefs', {'browser': 'ALL'})

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

try:
    print("=" * 70)
    print("MEGA 1,000 RAPID MULTI-ACTION REQUEST STRESS TEST (ANTI-FREEZE & ULTRA PERFORMANCE)")
    print("=" * 70)

    driver.get("http://localhost:3000/")
    for _ in range(30):
        if driver.execute_script("return !!(window.app && window.app.mindmap && window.app.mindmap.root);"):
            break
        time.sleep(0.2)
    time.sleep(1)

    t0 = time.time()
    res = driver.execute_script("""
        const app = window.app;
        let ops = 0;
        for (let i = 0; i < 1000; i++) {
          const root = app.mindmap.root;
          if (!root) continue;
          ops++;
          const mod = i % 10;
          if (mod === 0) {
            app.mindmap.addChild(root.id, `Dynamic Node ${i}`);
          } else if (mod === 1) {
            app.mindmap.updateNode(root.id, { text: `<b>Dynamic Rich Text ${i}</b>: \\\\[ \\\\frac{a}{b} \\\\]` });
          } else if (mod === 2) {
            app.renderMap();
          } else if (mod === 3) {
            app.canvas.zoomIn(0.02);
          } else if (mod === 4) {
            app.canvas.zoomOut(0.02);
          } else if (mod === 5) {
            app.mindmap.resetPositions(root.id);
          } else if (mod === 6) {
            app.saveState();
          } else if (mod === 7) {
            app.history.undo();
          } else if (mod === 8) {
            app.history.redo();
          } else {
            app.mindmap._rebuildNodeMap();
          }
        }
        app.renderMap();
        return ops;
    """)
    t1 = time.time()
    duration = t1 - t0
    print(f"Exec Total Operations: {res} completed in {duration:.2f} seconds!")
    print(f"Performance Throughput: {res / duration:.1f} requests/second!")

    # Verify zero severe console errors
    logs = driver.get_log('browser')
    severe_errors = [log for log in logs if log['level'] == 'SEVERE']
    print(f"Severe console errors count: {len(severe_errors)}")
    assert len(severe_errors) == 0, f"Found severe console errors: {severe_errors}"
    assert duration < 10.0, f"Stress test took too long ({duration:.2f}s)! Possible freeze!"

    print("\n[SUCCESS] MEGA 1,000 REQUEST STRESS TEST PASSED WITH 0 ERRORS AND 0 FREEZE!")

finally:
    driver.quit()

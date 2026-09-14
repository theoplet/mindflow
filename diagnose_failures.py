import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By

options = webdriver.ChromeOptions()
options.add_argument('--headless=new')
options.add_argument('--window-size=1600,1000')

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

try:
    driver.get("http://localhost:3000/")
    for _ in range(30):
        if driver.execute_script("return !!(window.app && window.app.mindmap && window.app.mindmap.root);"):
            break
        time.sleep(0.2)
    time.sleep(1)

    # TEST 1: Context menu uses 'open' class, not 'hidden'
    print("=== TEST 1: Context Menu CSS class check ===")
    
    classes_before = driver.execute_script("return document.getElementById('context-menu').className;")
    print(f"  Context menu classes (initial): '{classes_before}'")
    
    root_id = driver.execute_script("return window.app.mindmap.root.id;")
    driver.execute_script(f"window.app.handleContextMenu('{root_id}', {{ clientX: 400, clientY: 300 }});")
    time.sleep(0.3)
    
    classes_after_show = driver.execute_script("return document.getElementById('context-menu').className;")
    print(f"  Context menu classes (after show): '{classes_after_show}'")
    has_open = 'open' in classes_after_show
    print(f"  Has 'open' class: {has_open}")
    
    driver.execute_script("window.app.hideContextMenu();")
    time.sleep(0.2)
    
    classes_after_hide = driver.execute_script("return document.getElementById('context-menu').className;")
    print(f"  Context menu classes (after hide): '{classes_after_hide}'")
    no_open = 'open' not in classes_after_hide
    print(f"  'open' class removed: {no_open}")
    print(f"  VERDICT: hideContextMenu() {'WORKS CORRECTLY' if no_open else 'BROKEN'} (uses 'open' class, not 'hidden')")
    
    # TEST 2: Canvas click deselect - check what's at (30,30)
    print("\n=== TEST 2: Canvas click target diagnosis ===")
    
    driver.execute_script(f"window.app.mindmap.selectNode('{root_id}');")
    time.sleep(0.2)
    
    element_at_30 = driver.execute_script("""
        const el = document.elementFromPoint(30, 30);
        return el ? el.tagName + '.' + el.className.substring(0, 60) : 'null';
    """)
    print(f"  Element at (30,30): {element_at_30}")
    
    # Try clicking at a truly empty spot
    element_at_far = driver.execute_script("""
        const el = document.elementFromPoint(1500, 900);
        return el ? el.tagName + '.' + el.className.substring(0, 60) : 'null';
    """)
    print(f"  Element at (1500,900): {element_at_far}")
    
    # Try programmatic deselect via canvas click dispatch
    driver.execute_script(f"window.app.mindmap.selectNode('{root_id}');")
    time.sleep(0.2)
    
    driver.execute_script("""
        const canvas = document.getElementById('mindmap-canvas');
        canvas.dispatchEvent(new MouseEvent('click', { 
            bubbles: true, clientX: 1500, clientY: 900 
        }));
    """)
    time.sleep(0.3)
    
    after = driver.execute_script("return window.app.mindmap.getSelectedNode();")
    print(f"  After dispatching click at (1500,900): selected = {after}")
    print(f"  VERDICT: Canvas click deselect {'WORKS' if after is None else 'NEEDS FIX'}")
    
    # Also test dblclick
    driver.execute_script(f"window.app.mindmap.selectNode('{root_id}');")
    time.sleep(0.2)
    
    driver.execute_script("""
        const canvas = document.getElementById('mindmap-canvas');
        canvas.dispatchEvent(new MouseEvent('dblclick', { 
            bubbles: true, clientX: 1500, clientY: 900 
        }));
    """)
    time.sleep(0.3)
    
    after_dbl = driver.execute_script("return window.app.mindmap.getSelectedNode();")
    print(f"  After dispatching dblclick at (1500,900): selected = {after_dbl}")
    print(f"  VERDICT: Canvas dblclick deselect {'WORKS' if after_dbl is None else 'NEEDS FIX'}")

finally:
    driver.quit()

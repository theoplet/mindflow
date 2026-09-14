import time
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

passed = 0
failed = 0

def test(name, condition, extra=""):
    global passed, failed
    if condition:
        print(f"  [PASS] {name}")
        passed += 1
    else:
        print(f"  [FAIL] {name} - {extra}")
        failed += 1

try:
    print("=" * 70)
    print("RUNNING 5-BUG FIX VERIFICATION SUITE")
    print("=" * 70)

    driver.get("http://localhost:3000/index.html")
    for _ in range(50):
        if driver.execute_script("return !!(window.app && window.app.mindmap && window.app.mindmap.root);"):
            break
        time.sleep(0.2)
    time.sleep(0.5)

    # -------------------------------------------------------------
    # BUG #1: Viền 'selected' biến mất sau khi render lại node khác
    # -------------------------------------------------------------
    print("\n--- Testing Bug #1: Selected class preservation ---")
    res1 = driver.execute_script("""
        const app = window.app;
        app.createNewMap();
        const root = app.mindmap.root;
        const childA = app.mindmap.addChild(root.id, 'Topic A');
        const childB = app.mindmap.addChild(root.id, 'Topic B');
        app._doRenderMap();
        
        // Select child A
        app.mindmap.selectNode(childA.id);
        const elA_before = app.renderer.nodeElements.get(childA.id);
        const hasSelectedBefore = elA_before ? elA_before.classList.contains('selected') : false;
        
        // Now update node B and re-render
        app.mindmap.updateNode(childB.id, { text: 'Topic B Updated', color: '#EF4444' });
        app._doRenderMap();
        
        const elA_after = app.renderer.nodeElements.get(childA.id);
        const hasSelectedAfter = elA_after ? elA_after.classList.contains('selected') : false;
        
        return {
            hasSelectedBefore,
            hasSelectedAfter,
            selectedNodeId: app.mindmap.selectedNodeId,
            childAId: childA ? childA.id : null
        };
    """)
    test("Node A was selected before update", res1["hasSelectedBefore"] == True)
    test("Node A STILL has 'selected' class after updating Node B", res1["hasSelectedAfter"] == True, f"State: {res1}")

    # -------------------------------------------------------------
    # BUG #2: Duplicate methods in App & hideAllContextBoxes()
    # -------------------------------------------------------------
    print("\n--- Testing Bug #2: Duplicate methods in class App & state cleanup ---")
    res2 = driver.execute_script("""
        const app = window.app;
        // Simulate Select All Lines
        app.allLinesSelected = true;
        app.selectedLineChildId = 'dummy-id';
        const btnAll = document.getElementById('btn-select-all-lines');
        if (btnAll) btnAll.classList.add('active');
        const lineBox = document.getElementById('line-context-box');
        if (lineBox) lineBox.classList.remove('hidden');
        
        // Call hideAllContextBoxes
        app.hideAllContextBoxes();
        
        return {
            allLinesSelected: app.allLinesSelected,
            selectedLineChildId: app.selectedLineChildId,
            btnHasActive: btnAll ? btnAll.classList.contains('active') : false,
            lineBoxHidden: lineBox ? lineBox.classList.contains('hidden') : true
        };
    """)
    test("hideAllContextBoxes() resets allLinesSelected to false", res2["allLinesSelected"] == False)
    test("hideAllContextBoxes() resets selectedLineChildId to null", res2["selectedLineChildId"] is None)
    test("hideAllContextBoxes() removes .active from #btn-select-all-lines", res2["btnHasActive"] == False)
    test("hideAllContextBoxes() hides #line-context-box", res2["lineBoxHidden"] == True)

    # -------------------------------------------------------------
    # BUG #3: detachNode() with x=0 or y=0
    # -------------------------------------------------------------
    print("\n--- Testing Bug #3: detachNode() with coordinates at x=0 or y=0 ---")
    res3 = driver.execute_script("""
        const app = window.app;
        app.createNewMap();
        const root = app.mindmap.root;
        const child = app.mindmap.addChild(root.id, 'Branch at Zero');
        child.x = 0;
        child.y = 0;
        
        // Detach child
        app.mindmap.detachNode(child.id);
        const detached = app.mindmap.findNode(child.id);
        
        return {
            isRoot: app.mindmap.isRoot(child.id),
            customX: detached ? detached.customX : undefined,
            customY: detached ? detached.customY : undefined
        };
    """)
    test("detachNode() converts child into independent root", res3["isRoot"] == True)
    test("detachNode() preserves customX = 0", res3["customX"] == 0, f"Got: {res3['customX']}")
    test("detachNode() preserves customY = 0", res3["customY"] == 0, f"Got: {res3['customY']}")

    # -------------------------------------------------------------
    # BUG #4: Currency text with 2 '$' vs Real KaTeX math
    # -------------------------------------------------------------
    print("\n--- Testing Bug #4: Currency '$' vs Real LaTeX math ---")
    res4 = driver.execute_script("""
        const app = window.app;
        app.createNewMap();
        const root = app.mindmap.root;
        
        // 1. Currency text
        const childUSD = app.mindmap.addChild(root.id, 'Giá: $5 và $10');
        
        // 2. Real math text
        const childMath = app.mindmap.addChild(root.id, 'Central Topic <v2.0> & $x < y$');
        
        app._doRenderMap();
        
        const elUSD = app.renderer.nodeElements.get(childUSD.id);
        const textUSD = elUSD ? elUSD.querySelector('.node-text').innerHTML : '';
        const hasMathUSD = elUSD ? elUSD.classList.contains('has-math') : false;
        
        const elMath = app.renderer.nodeElements.get(childMath.id);
        const textMath = elMath ? elMath.querySelector('.node-text').innerHTML : '';
        const hasMathReal = elMath ? elMath.classList.contains('has-math') : false;
        
        return {
            textUSD,
            hasMathUSD,
            textMath,
            hasMathReal
        };
    """)
    test("USD currency does NOT get 'has-math' class", res4["hasMathUSD"] == False, f"hasMathUSD: {res4['hasMathUSD']}")
    test("USD currency does NOT show 'Lỗi LaTeX'", "Lỗi LaTeX" not in res4["textUSD"], f"textUSD: {res4['textUSD']}")
    test("USD currency retains '$5 và $10'", "$5" in res4["textUSD"] and "$10" in res4["textUSD"], f"textUSD: {res4['textUSD']}")
    test("Real math gets 'has-math' class", res4["hasMathReal"] == True, f"hasMathReal: {res4['hasMathReal']}")
    test("Real math renders KaTeX span", "katex-rendered" in res4["textMath"], f"textMath: {res4['textMath']}")

    # -------------------------------------------------------------
    # BUG #5: Dead CSS node-color-* classes
    # -------------------------------------------------------------
    print("\n--- Testing Bug #5: Node color styling without dead CSS classes ---")
    res5 = driver.execute_script("""
        const app = window.app;
        const root = app.mindmap.root;
        const childC = app.mindmap.addChild(root.id, 'Colored Node');
        app.mindmap.updateNode(childC.id, { color: '#3B82F6' });
        app._doRenderMap();
        
        const el = app.renderer.nodeElements.get(childC.id);
        return {
            classes: el ? el.className : '',
            borderLeft: el ? el.style.borderLeft : ''
        };
    """)
    test("Node has inline borderLeft correctly set to #3B82F6", "3px solid rgb(59, 130, 246)" in res5["borderLeft"] or "#3B82F6" in res5["borderLeft"], f"borderLeft: {res5['borderLeft']}")
    test("Node does NOT have dead node-color-3B82F6 class", "node-color-" not in res5["classes"], f"classes: {res5['classes']}")

    # -------------------------------------------------------------
    # Console errors check
    # -------------------------------------------------------------
    print("\n--- Checking Browser Console Logs ---")
    logs = driver.get_log('browser')
    severe_errors = [l for l in logs if l['level'] == 'SEVERE']
    test("Zero SEVERE browser console errors", len(severe_errors) == 0, f"Errors: {severe_errors}")

    print("\n" + "=" * 70)
    print(f"RESULTS: {passed} PASSED, {failed} FAILED")
    print("=" * 70)

except Exception as e:
    import traceback
    print("Exception during test execution:", e)
    traceback.print_exc()
finally:
    driver.quit()
    sys.exit(0 if failed == 0 else 1)

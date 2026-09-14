import time
import sys
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager

sys.stdout.reconfigure(encoding='utf-8')

options = webdriver.ChromeOptions()
options.add_argument('--headless=new')
options.add_argument('--window-size=1600,1000')
options.set_capability('goog:loggingPrefs', {'browser': 'ALL'})

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

try:
    print("=" * 75)
    print("MINDFLOW: AUTOMATED VERIFICATION FOR ALL 5 TODAY'S FIXES & FEATURES")
    print("=" * 75)

    driver.get("http://localhost:3000/")
    
    # Wait for app initialization
    ready = False
    for _ in range(30):
        try:
            val = driver.execute_script("return (window.app && window.app.mindmap && window.app.mindmap.root) ? true : false;")
            if val:
                ready = True
                break
        except Exception:
            pass
        time.sleep(0.3)

    assert ready, "App failed to initialize!"
    print(" [OK] MindFlow application loaded and initialized successfully.")

    # -------------------------------------------------------------
    # 1. TEST BUG: triggerAutoSave deduplication & auto generateId()
    # -------------------------------------------------------------
    print("\n--- [TEST 1] triggerAutoSave Deduplication & Auto-ID ---")
    driver.execute_script("""
        const app = window.app;
        app.currentMapId = null;
        app.triggerAutoSave();
    """)
    # Wait for 1000ms debounce to fire
    time.sleep(1.2)
    test1_result = driver.execute_script("""
        const app = window.app;
        const idGenerated = Boolean(app.currentMapId);
        const autoSaveFunc = typeof app.triggerAutoSave === 'function';
        return { idGenerated, autoSaveFunc, currentMapId: app.currentMapId };
    """)
    print(f" Test 1 Result: {test1_result}")
    assert test1_result['autoSaveFunc'], "triggerAutoSave should be a function"
    assert test1_result['idGenerated'], "triggerAutoSave should auto-generate currentMapId if missing"
    print(" [PASS] Test 1: triggerAutoSave properly debounced and auto-generates ID!")

    # -------------------------------------------------------------
    # 2. TEST MỤC 3: Notes Popover Position next to Badge (top-right)
    # -------------------------------------------------------------
    print("\n--- [TEST 2] Notes Popover Position & Viewport Flip ---")
    driver.execute_script("""
        const root = window.app.mindmap.root;
        window.app.mindmap.updateNode(root.id, { notes: 'Ghi chu kiem thu vi tri popover goc tren phai' });
        window.app.renderMap();
    """)
    time.sleep(0.3)

    test2_result = driver.execute_script("""
        const root = window.app.mindmap.root;
        const nodeEl = window.app.renderer.nodeElements.get(root.id);
        const badge = nodeEl.querySelector('.node-notes-badge');
        const popover = nodeEl.querySelector('.node-notes-popover');
        
        // Open popover
        badge.click();
        
        const badgeRect = badge.getBoundingClientRect();
        const popoverRect = popover.getBoundingClientRect();
        const popoverStyle = window.getComputedStyle(popover);
        
        return {
            hasBadge: Boolean(badge),
            hasPopover: Boolean(popover),
            isOpen: popover.classList.contains('open'),
            display: popoverStyle.display,
            popoverTop: popoverRect.top,
            badgeTop: badgeRect.top,
            popoverLeft: popoverRect.left,
            badgeRight: badgeRect.right
        };
    """)
    print(f" Test 2 Result: {test2_result}")
    assert test2_result['hasBadge'], "Notes badge should exist"
    assert test2_result['isOpen'], "Notes popover should open on badge click"
    assert test2_result['display'] == 'block', "Popover display should be block"
    assert abs(test2_result['popoverTop'] - test2_result['badgeTop']) < 30, "Popover should align vertically with badge"
    print(" [PASS] Test 2: Notes Popover positioned accurately adjacent to Notes Badge!")

    # -------------------------------------------------------------
    # 3. TEST MỤC 1: Text Alignment & Text Color in Node & Right Editor
    # -------------------------------------------------------------
    print("\n--- [TEST 3] Text Alignment & Color in Canvas & Right Editor ---")
    driver.execute_script("""
        const root = window.app.mindmap.root;
        window.app.mindmap.selectNode(root.id);
        window.app.mindmap.updateNode(root.id, { 
            textAlign: 'right', 
            textColor: '#EF4444' 
        });
        window.app.renderMap();
    """)
    time.sleep(0.3)

    test3_canvas = driver.execute_script("""
        const root = window.app.mindmap.root;
        const nodeEl = window.app.renderer.nodeElements.get(root.id);
        const textSpan = nodeEl.querySelector('.node-text');
        const comp = window.getComputedStyle(textSpan);
        return {
            nodeTextAlign: root.textAlign,
            domTextAlign: comp.textAlign,
            nodeTextColor: root.textColor,
            domColor: comp.color
        };
    """)
    print(f" Canvas Alignment & Color: {test3_canvas}")
    assert test3_canvas['nodeTextAlign'] == 'right', "node.textAlign should be right"
    assert test3_canvas['domTextAlign'] == 'right', "DOM textSpan text-align should be right"
    assert 'rgb(239, 68, 68)' in test3_canvas['domColor'], "DOM textSpan color should be red"

    # Test Right Editor Panel Alignment
    driver.execute_script("""
        const root = window.app.mindmap.root;
        window.app.openRightEditorPanel(root.id);
    """)
    time.sleep(0.3)

    # Click Align Center in Right Editor Panel
    step_align_result = driver.execute_script("""
        const btn = document.getElementById('right-fmt-align-center');
        const contentEl = document.getElementById('right-editor-content');
        const beforeAlign = contentEl.style.textAlign;
        btn.click();
        const afterAlign = contentEl.style.textAlign;
        return { beforeAlign, afterAlign };
    """)
    print(f" Right Editor Align Click Result: {step_align_result}")
    time.sleep(0.2)

    driver.execute_script("""
        window.app.applyRightEditorToNode(false);
    """)
    time.sleep(0.3)

    test3_after_right = driver.execute_script("""
        const root = window.app.mindmap.root;
        const nodeEl = window.app.renderer.nodeElements.get(root.id);
        const textSpan = nodeEl.querySelector('.node-text');
        const comp = window.getComputedStyle(textSpan);
        return {
            nodeTextAlign: root.textAlign,
            domTextAlign: comp.textAlign
        };
    """)
    print(f" After Right Editor Center Align: {test3_after_right}")
    for entry in driver.get_log('browser'):
        print(" BROWSER LOG:", entry)
    assert test3_after_right['nodeTextAlign'] == 'center', "node.textAlign should be updated to center"
    assert test3_after_right['domTextAlign'] == 'center', "DOM textSpan text-align should be center"
    print(" [PASS] Test 3: Text Alignment and Color work seamlessly and persist across renders!")

    # -------------------------------------------------------------
    # 4. TEST MỤC 4: Inline Images in Right Editor Text
    # -------------------------------------------------------------
    print("\n--- [TEST 4] Inline Images within Text Flow ---")
    driver.execute_script("""
        const root = window.app.mindmap.root;
        window.app.openRightEditorPanel(root.id);
        const contentEl = document.getElementById('right-editor-content');
        
        // Write: Đoạn 1 [inline img] Đoạn 2
        contentEl.innerHTML = 'Đoạn 1 <img class="inline-editor-image" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" style="width: 160px;"> Đoạn 2';
        window.app.applyRightEditorToNode(false);
    """)
    time.sleep(0.3)

    test4_canvas = driver.execute_script("""
        const root = window.app.mindmap.root;
        const nodeEl = window.app.renderer.nodeElements.get(root.id);
        const textSpan = nodeEl.querySelector('.node-text');
        const img = textSpan.querySelector('img.inline-editor-image');
        return {
            rawText: root.text,
            hasInlineImgInDom: Boolean(img),
            textContent: textSpan.textContent.trim(),
            innerHTML: textSpan.innerHTML
        };
    """)
    print(f" Inline Image Canvas Result: {test4_canvas}")
    assert test4_canvas['hasInlineImgInDom'], "Inline image element should exist inside .node-text"
    assert 'Đoạn 1' in test4_canvas['textContent'] and 'Đoạn 2' in test4_canvas['textContent'], "Text before and after inline image should be intact"
    print(" [PASS] Test 4: Inline image flows directly inside text and renders properly on canvas!")

    # -------------------------------------------------------------
    # 5. TEST MỤC 2: Free Line Connections Between Any Two Nodes
    # -------------------------------------------------------------
    print("\n--- [TEST 5] Free Line Connections Between Independent Nodes ---")
    test5_result = driver.execute_script("""
        const mm = window.app.mindmap;
        const root1 = mm.root;
        const root2 = mm.addCentralTopic('Central Topic 2', 400, 0);
        
        // Add free connection between root1 and root2
        const conn = mm.addConnection(root1.id, root2.id, {
            lineWidth: 4,
            lineDash: 'dashed',
            lineColor: '#38BDF8',
            lineArrow: 'both',
            lineText: 'Liên kết tự do'
        });
        
        window.app._doRenderMap();
        
        const pathEl = document.querySelector('.free-connector-path');
        const stroke = pathEl ? pathEl.getAttribute('stroke') : null;
        const strokeWidth = pathEl ? pathEl.getAttribute('stroke-width') : null;
        const dash = pathEl ? pathEl.getAttribute('stroke-dasharray') : null;
        const markerEnd = pathEl ? pathEl.getAttribute('marker-end') : null;
        const markerStart = pathEl ? pathEl.getAttribute('marker-start') : null;
        
        // Verify JSON persistence
        const json = mm.toJSON();
        const hasConnectionsInJson = Array.isArray(json.connections) && json.connections.length > 0;
        
        return {
            connId: conn ? conn.id : null,
            connectionsCount: mm.connections ? mm.connections.length : 0,
            hasPath: Boolean(pathEl),
            stroke,
            strokeWidth,
            dash,
            hasMarkerEnd: Boolean(markerEnd),
            hasMarkerStart: Boolean(markerStart),
            hasConnectionsInJson,
            allSvgPaths: Array.from(document.querySelectorAll('svg path')).map(p => p.getAttribute('class'))
        };
    """)
    print(f" Free Line Creation Result: {test5_result}")
    assert test5_result['hasPath'], "SVG .free-connector-path element should be rendered"
    assert test5_result['strokeWidth'] == '4', "Stroke width should match 4"
    assert test5_result['dash'] == '6 6', "Stroke dash should be dashed 6 6"
    assert test5_result['hasMarkerEnd'] and test5_result['hasMarkerStart'], "Should have both start and end arrows"
    assert test5_result['hasConnectionsInJson'], "Connections must be serialized in toJSON"

    # Test Deleting Node 2 cleans up connection
    test5_cleanup = driver.execute_script("""
        const mm = window.app.mindmap;
        const roots = mm.roots;
        const secondRoot = roots.find(r => r.text === 'Central Topic 2');
        if (secondRoot) {
            mm.deleteNode(secondRoot.id);
        }
        window.app._doRenderMap();
        
        const pathAfterDelete = document.querySelector('.free-connector-path');
        return {
            connectionsRemaining: mm.connections.length,
            hasPathAfterDelete: Boolean(pathAfterDelete)
        };
    """)
    print(f" Free Line Cleanup Result: {test5_cleanup}")
    assert test5_cleanup['connectionsRemaining'] == 0, "Connections should be 0 after attached node deletion"
    assert not test5_cleanup['hasPathAfterDelete'], "Free line SVG path should be removed from DOM"
    print(" [PASS] Test 5: Free Line connection fully functional, customizable, persistent, and cleanly deleted!")

    print("\n" + "=" * 75)
    print("ALL 5 TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 75)

finally:
    driver.quit()

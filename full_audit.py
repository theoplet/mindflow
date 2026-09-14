import time
import os
import json
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains

options = webdriver.ChromeOptions()
options.add_argument('--headless=new')
options.add_argument('--window-size=1600,1000')
options.set_capability('goog:loggingPrefs', {'browser': 'ALL'})

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
output_dir = os.path.dirname(os.path.abspath(__file__))
results = []
issues = []

def test(name, condition, detail=""):
    status = "PASS" if condition else "FAIL"
    safe_detail = str(detail).encode('ascii', 'ignore').decode('ascii')
    results.append((name, status, safe_detail))
    print(f"  [{status}] {name} {safe_detail}")
    if not condition:
        issues.append(f"FAIL: {name} - {safe_detail}")

def wait_app():
    for _ in range(40):
        if driver.execute_script("return !!(window.app && window.app.mindmap && window.app.mindmap.root);"):
            return True
        time.sleep(0.2)
    return False

def get_console_errors():
    logs = driver.get_log('browser')
    return [e for e in logs if e['level'] == 'SEVERE' and 'favicon' not in e['message']]

def run_section(name, fn):
    print(f"\n--- {name} ---")
    try:
        fn()
    except Exception as e:
        msg = str(e)[:200].encode('ascii','ignore').decode('ascii')
        issues.append(f"CRASH in {name}: {msg}")
        print(f"  [CRASH] {name}: {msg}")

try:
    print("=" * 80)
    print("COMPREHENSIVE MINDFLOW FEATURE AUDIT v11.0 - ALL FUNCTIONS")
    print("=" * 80)

    driver.get("http://localhost:3000/")
    assert wait_app(), "App failed to boot"
    time.sleep(1)
    driver.execute_script("localStorage.clear();")
    driver.get("http://localhost:3000/")
    assert wait_app(), "App failed to boot after clear"
    time.sleep(1)

    # ============================================================
    def section_1():
        has_root = driver.execute_script("return !!window.app.mindmap.root;")
        test("1.1 App boots with a root node", has_root)
        root_text = driver.execute_script("return window.app.mindmap.root.text;")
        test("1.2 Root node has default text", root_text is not None and len(root_text) > 0, f"(text: '{root_text}')")
        child_count = driver.execute_script("return window.app.mindmap.root.children.length;")
        test("1.3 Default map has child nodes", child_count > 0, f"(children: {child_count})")
        node_els = driver.find_elements(By.CLASS_NAME, "mindmap-node")
        test("1.4 Node DOM elements rendered", len(node_els) > 0, f"(DOM nodes: {len(node_els)})")
        svg_paths = driver.find_elements(By.CLASS_NAME, "connector-path")
        test("1.5 Connector SVG paths rendered", len(svg_paths) > 0, f"(paths: {len(svg_paths)})")
    run_section("SECTION 1: APP BOOT & DEFAULT MAP", section_1)

    # ============================================================
    def section_2():
        global new_root_id
        old_root_id = driver.execute_script("return window.app.mindmap.root.id;")
        driver.execute_script("window.app.createNewMap();")
        time.sleep(0.5)
        new_root_id = driver.execute_script("return window.app.mindmap.root.id;")
        test("2.1 New map creates fresh root node", new_root_id != old_root_id)
        new_map_id = driver.execute_script("return window.app.currentMapId;")
        test("2.2 New map has a unique map ID", new_map_id is not None and len(new_map_id) > 10)
    run_section("SECTION 2: NEW MAP", section_2)

    # ============================================================
    def section_3():
        root_id = driver.execute_script("return window.app.mindmap.root.id;")
        driver.execute_script(f"window.app.mindmap.addChild('{root_id}', 'Child A');")
        time.sleep(0.3)
        driver.execute_script(f"window.app.mindmap.addChild('{root_id}', 'Child B');")
        time.sleep(0.3)
        children = driver.execute_script("return window.app.mindmap.root.children.map(c => c.text);")
        test("3.1 Child A added to root", 'Child A' in children, f"(children: {children})")
        test("3.2 Child B added to root", 'Child B' in children)
    run_section("SECTION 3: ADD CHILD NODE", section_3)

    # ============================================================
    def section_4():
        child_a_id = driver.execute_script("return window.app.mindmap.root.children.find(c => c.text === 'Child A').id;")
        driver.execute_script(f"window.app.mindmap.addSibling('{child_a_id}', 'Sibling of A');")
        time.sleep(0.3)
        children_after = driver.execute_script("return window.app.mindmap.root.children.map(c => c.text);")
        test("4.1 Sibling of A added", 'Sibling of A' in children_after, f"(children: {children_after})")
    run_section("SECTION 4: ADD SIBLING NODE", section_4)

    # ============================================================
    def section_5():
        sib_id = driver.execute_script("return window.app.mindmap.root.children.find(c => c.text === 'Sibling of A').id;")
        count_before_del = driver.execute_script("return window.app.mindmap.root.children.length;")
        driver.execute_script(f"window.app.mindmap.selectNode('{sib_id}'); window.app.mindmap.deleteNode('{sib_id}');")
        time.sleep(0.3)
        count_after_del = driver.execute_script("return window.app.mindmap.root.children.length;")
        test("5.1 Delete node reduces child count", count_after_del == count_before_del - 1, f"(before: {count_before_del}, after: {count_after_del})")

        driver.execute_script("window.app.undo();")
        time.sleep(0.5)
        restored = driver.execute_script("return window.app.mindmap.root.children.some(c => c.text === 'Sibling of A');")
        test("5.2 Undo restores deleted node", restored)

        driver.execute_script("window.app.redo();")
        time.sleep(0.5)
        count_after_redo = driver.execute_script("return window.app.mindmap.root.children.length;")
        test("5.3 Redo re-deletes node", count_after_redo == count_before_del - 1, f"(count after redo: {count_after_redo})")
    run_section("SECTION 5: DELETE NODE + UNDO/REDO", section_5)

    # ============================================================
    def section_6():
        child_a_id = driver.execute_script("return window.app.mindmap.root.children.find(c => c.text === 'Child A').id;")
        driver.execute_script(f"window.app.mindmap.selectNode('{child_a_id}');")
        time.sleep(0.2)
        selected = driver.execute_script("return window.app.mindmap.getSelectedNode();")
        test("6.1 Node selected via selectNode()", selected is not None and selected.get('text') == 'Child A')
        sel_els = driver.find_elements(By.CSS_SELECTOR, ".mindmap-node.selected")
        test("6.2 Selected node has .selected CSS class", len(sel_els) > 0)
        driver.execute_script("window.app.mindmap.selectNode(null);")
        time.sleep(0.2)
        deselected = driver.execute_script("return window.app.mindmap.getSelectedNode();")
        test("6.3 Deselect node (selectNode(null))", deselected is None)
    run_section("SECTION 6: SELECT NODE", section_6)

    # ============================================================
    def section_7():
        child_a_id = driver.execute_script("return window.app.mindmap.root.children.find(c => c.text === 'Child A').id;")
        driver.execute_script(f"""
            window.app.mindmap.updateNode('{child_a_id}', {{
                text: 'Updated Child A', fontSize: 20, textColor: '#FF5555', color: '#2D1B69'
            }});
            window.app.renderMap();
        """)
        time.sleep(0.3)
        updated = driver.execute_script(f"return window.app.mindmap.findNode('{child_a_id}');")
        test("7.1 Node text updated", updated.get('text') == 'Updated Child A')
        test("7.2 Node fontSize updated", updated.get('fontSize') == 20)
        test("7.3 Node textColor updated", updated.get('textColor') == '#FF5555')
        test("7.4 Node color updated", updated.get('color') == '#2D1B69')
    run_section("SECTION 7: UPDATE NODE PROPERTIES", section_7)

    # ============================================================
    def section_8():
        root_id = driver.execute_script("return window.app.mindmap.root.id;")
        driver.execute_script(f"window.app.mindmap.toggleCollapse('{root_id}');")
        time.sleep(0.3)
        is_collapsed = driver.execute_script(f"return window.app.mindmap.findNode('{root_id}').collapsed;")
        test("8.1 Toggle collapse sets collapsed=true", is_collapsed == True)
        driver.execute_script(f"window.app.mindmap.toggleCollapse('{root_id}');")
        time.sleep(0.3)
        is_expanded = driver.execute_script(f"return !window.app.mindmap.findNode('{root_id}').collapsed;")
        test("8.2 Toggle again expands (collapsed=false)", is_expanded == True)
    run_section("SECTION 8: COLLAPSE / EXPAND", section_8)

    # ============================================================
    def section_9():
        driver.execute_script("""
            document.getElementById('map-name').value = 'Test Map Alpha';
            window.app.currentMapName = 'Test Map Alpha';
            window.app.saveCurrentMap();
        """)
        time.sleep(0.3)
        saved_map_id = driver.execute_script("return window.app.currentMapId;")
        map_list = driver.execute_script("return window.app.storage.getMapList();")
        found_saved = any(m.get('name') == 'Test Map Alpha' for m in map_list)
        test("9.1 Map saved to localStorage", found_saved, f"(map list count: {len(map_list)})")

        driver.execute_script("window.app.createNewMap();")
        time.sleep(0.5)
        second_map_id = driver.execute_script("return window.app.currentMapId;")
        test("9.2 Second map created with different ID", second_map_id != saved_map_id)

        driver.execute_script(f"window.app.loadMapById('{saved_map_id}');")
        time.sleep(0.5)
        loaded_name = driver.execute_script("return window.app.currentMapName;")
        loaded_id = driver.execute_script("return window.app.currentMapId;")
        test("9.3 First map loaded back by ID", loaded_id == saved_map_id and loaded_name == 'Test Map Alpha', f"(loaded name: '{loaded_name}')")
    run_section("SECTION 9: SAVE & LOAD MAP", section_9)

    # ============================================================
    def section_10():
        root_id = driver.execute_script("return window.app.mindmap.root.id;")
        long_text = 'VeryLongWord' * 15
        driver.execute_script(f"""
            window.app.mindmap.updateNode('{root_id}', {{ text: '{long_text}', fontSize: 18 }});
            delete window.app.mindmap.findNode('{root_id}').customWidth;
            delete window.app.mindmap.findNode('{root_id}').customHeight;
            window.app.renderMap();
        """)
        time.sleep(0.5)
        node_w = driver.execute_script("return document.querySelector('.mindmap-node').offsetWidth;")
        text_w = driver.execute_script("return document.querySelector('.node-text').scrollWidth;")
        test("10.1 Long text wraps inside node (no overflow)", text_w <= node_w + 2, f"(node: {node_w}px, text scroll: {text_w}px)")
    run_section("SECTION 10: NODE TEXT AUTO-FIT", section_10)

    # ============================================================
    def section_11():
        root_id = driver.execute_script("return window.app.mindmap.root.id;")
        driver.execute_script(f"""
            const imgs = [
                'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="40"><rect width="60" height="40" fill="%23A855F7"/></svg>',
                'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="40"><rect width="60" height="40" fill="%233B82F6"/></svg>',
                'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="40"><rect width="60" height="40" fill="%2314B8A6"/></svg>',
                'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="40"><rect width="60" height="40" fill="%23EAB308"/></svg>'
            ];
            window.app.mindmap.updateNode('{root_id}', {{ images: imgs }});
            window.app.renderMap();
        """)
        time.sleep(0.5)
        img_container = driver.find_elements(By.CLASS_NAME, "node-images-container")
        test("11.1 Image container rendered", len(img_container) > 0)
        img_items = driver.find_elements(By.CLASS_NAME, "node-image-item")
        test("11.2 4 images rendered in node", len(img_items) == 4, f"(found: {len(img_items)})")
        gap = driver.execute_script("return window.getComputedStyle(document.querySelector('.node-images-container')).gap;")
        test("11.3 Image grid gap is tight (2px)", gap == '2px', f"(gap: {gap})")
    run_section("SECTION 11: IMAGES IN NODE", section_11)

    # ============================================================
    def section_12():
        child_a_id = driver.execute_script("return window.app.mindmap.root.children.find(c => c.text === 'Updated Child A')?.id;")
        if not child_a_id:
            child_a_id = driver.execute_script("return window.app.mindmap.root.children[0]?.id;")
        driver.execute_script(f"window.app.mindmap.updateNode('{child_a_id}', {{ notes: 'Test note text' }}); window.app.renderMap();")
        time.sleep(0.3)
        notes_badge = driver.find_elements(By.CLASS_NAME, "node-notes-badge")
        test("12.1 Notes badge appears on node with notes", len(notes_badge) > 0)
        stored_notes = driver.execute_script(f"return window.app.mindmap.findNode('{child_a_id}').notes;")
        test("12.2 Notes text stored in node data", stored_notes == 'Test note text')
    run_section("SECTION 12: NOTES ON NODE", section_12)

    # ============================================================
    def section_13():
        child_a_id = driver.execute_script("return window.app.mindmap.root.children[0]?.id;")
        driver.execute_script(f"window.app.mindmap.updateNode('{child_a_id}', {{ icon: '🔥' }}); window.app.renderMap();")
        time.sleep(0.3)
        icon_badge = driver.find_elements(By.CLASS_NAME, "node-icon-badge")
        test("13.1 Icon badge rendered on node", len(icon_badge) > 0)
    run_section("SECTION 13: ICON ON NODE", section_13)

    # ============================================================
    def section_14():
        driver.execute_script("window.app.mindmap.setGlobalLineStyle({ style: 'dashed', thickness: 3, color: '#EF4444' }); window.app.renderMap();")
        time.sleep(0.3)
        global_style = driver.execute_script("return window.app.mindmap.globalLineStyle;")
        test("14.1 Global line style set to dashed", global_style.get('style') == 'dashed')
        test("14.2 Global line thickness set to 3", global_style.get('thickness') == 3)
        test("14.3 Global line color set to #EF4444", global_style.get('color') == '#EF4444')
    run_section("SECTION 14: LINE STYLING", section_14)

    # ============================================================
    def section_15():
        child_b_id = driver.execute_script("return window.app.mindmap.root.children.find(c => c.text === 'Child B')?.id;")
        if child_b_id:
            roots_before = driver.execute_script("return window.app.mindmap.roots.length;")
            driver.execute_script(f"window.app.mindmap.detachNode('{child_b_id}');")
            time.sleep(0.3)
            roots_after = driver.execute_script("return window.app.mindmap.roots.length;")
            test("15.1 Detach node creates new root (central topic)", roots_after == roots_before + 1, f"(roots before: {roots_before}, after: {roots_after})")
        else:
            test("15.1 Detach node - Child B not found", False, "(Child B missing)")
    run_section("SECTION 15: DETACH NODE", section_15)

    # ============================================================
    def section_16():
        menu_el = driver.find_element(By.ID, "context-menu")
        # Context menu starts hidden or visible depending on state
        root_id = driver.execute_script("return window.app.mindmap.root.id;")
        driver.execute_script(f"window.app.mindmap.selectNode('{root_id}');")
        driver.execute_script(f"window.app.handleContextMenu('{root_id}', {{ clientX: 400, clientY: 300 }});")
        time.sleep(0.3)
        is_visible = 'hidden' not in driver.find_element(By.ID, "context-menu").get_attribute('class')
        test("16.1 Context menu shown after handleContextMenu()", is_visible)
        driver.execute_script("window.app.hideContextMenu();")
        time.sleep(0.2)
        is_hidden_again = 'hidden' in driver.find_element(By.ID, "context-menu").get_attribute('class')
        test("16.2 Context menu hidden after hideContextMenu()", is_hidden_again)
    run_section("SECTION 16: CONTEXT MENU", section_16)

    # ============================================================
    def section_17():
        driver.execute_script("window.app.canvas.zoomIn();")
        time.sleep(0.2)
        scale_after_in = driver.execute_script("return window.app.canvas.scale;")
        test("17.1 Zoom in increases scale", scale_after_in > 1.0, f"(scale: {scale_after_in})")
        driver.execute_script("window.app.canvas.zoomOut(); window.app.canvas.zoomOut();")
        time.sleep(0.2)
        scale_after_out = driver.execute_script("return window.app.canvas.scale;")
        test("17.2 Zoom out decreases scale", scale_after_out < scale_after_in, f"(scale: {scale_after_out})")
    run_section("SECTION 17: CANVAS ZOOM", section_17)

    # ============================================================
    def section_18():
        driver.execute_script("""
            document.getElementById('node-formatting-bar').classList.remove('hidden');
            document.getElementById('line-context-box').classList.remove('hidden');
        """)
        time.sleep(0.1)
        driver.execute_script("window.app.canvas.emit('change', { scale: 1.5 });")
        time.sleep(0.3)
        bar_hidden = driver.execute_script("return document.getElementById('node-formatting-bar').classList.contains('hidden');")
        line_hidden = driver.execute_script("return document.getElementById('line-context-box').classList.contains('hidden');")
        test("18.1 Formatting bar auto-hidden on zoom", bar_hidden)
        test("18.2 Line context box auto-hidden on zoom", line_hidden)
    run_section("SECTION 18: HIDE CONTEXT BOXES ON ZOOM", section_18)

    # ============================================================
    def section_19():
        driver.execute_script("window.app.showOpenMapModal();")
        time.sleep(0.3)
        modal_open = driver.execute_script("return document.getElementById('open-modal').classList.contains('open');")
        test("19.1 Open map modal opens", modal_open)
        map_items = driver.find_elements(By.CLASS_NAME, "map-list-item")
        test("19.2 Map list items rendered", len(map_items) > 0, f"(items: {len(map_items)})")
        driver.execute_script("window.app.closeAllModals();")
        time.sleep(0.2)
        modal_closed = driver.execute_script("return !document.getElementById('open-modal').classList.contains('open');")
        test("19.3 Modal closes after closeAllModals()", modal_closed)
    run_section("SECTION 19: OPEN MAP MODAL", section_19)

    # ============================================================
    def section_20():
        json_data = driver.execute_script("return window.app.mindmap.toJSON();")
        test("20.1 toJSON() returns valid data", json_data is not None and 'roots' in json_data)
        test("20.2 toJSON() roots is array", isinstance(json_data.get('roots'), list))
    run_section("SECTION 20: EXPORT JSON", section_20)

    # ============================================================
    def section_21():
        root_id = driver.execute_script("return window.app.mindmap.root.id;")
        driver.execute_script(f"window.app.mindmap.selectNode('{root_id}');")
        time.sleep(0.2)
        canvas = driver.find_element(By.ID, "mindmap-canvas")
        w, h = canvas.size['width'], canvas.size['height']
        ActionChains(driver).move_to_element_with_offset(canvas, -w//2 + 50, -h//2 + 100).click().perform()
        time.sleep(0.3)
        after_click = driver.execute_script("return window.app.mindmap.getSelectedNode();")
        test("21.1 Clicking empty canvas deselects node", after_click is None)
    run_section("SECTION 21: CANVAS CLICK DESELECT", section_21)

    # ============================================================
    def section_22():
        root_id = driver.execute_script("return window.app.mindmap.root.id;")
        driver.execute_script(f"window.app.mindmap.selectNode('{root_id}');")
        time.sleep(0.2)
        canvas = driver.find_element(By.ID, "mindmap-canvas")
        w, h = canvas.size['width'], canvas.size['height']
        ActionChains(driver).move_to_element_with_offset(canvas, -w//2 + 50, -h//2 + 100).double_click().perform()
        time.sleep(0.3)
        after_dblclick = driver.execute_script("return window.app.mindmap.getSelectedNode();")
        test("22.1 Double-clicking empty canvas deselects node", after_dblclick is None)
    run_section("SECTION 22: DOUBLE-CLICK CANVAS DESELECT", section_22)

    # ============================================================
    def section_23():
        driver.execute_script("window.app.createNewMap();")
        time.sleep(0.3)
        t0 = time.time()
        driver.execute_script("""
            const root = window.app.mindmap.root;
            for (let i = 0; i < 50; i++) {
                window.app.mindmap.addChild(root.id, 'Stress ' + i);
            }
            window.app.renderMap();
            for (let i = 0; i < 50; i++) {
                window.app.mindmap.toggleCollapse(root.id);
            }
            for (let i = 0; i < 50; i++) {
                window.app.mindmap.selectNode(root.children[0]?.id || root.id);
                window.app.mindmap.selectNode(null);
            }
            window.app.renderMap();
        """)
        time.sleep(0.5)
        t1 = time.time()
        stress_ok = driver.execute_script("return !!window.app.mindmap.root;")
        test("23.1 App survived 200 rapid operations without crash", stress_ok, f"(elapsed: {t1-t0:.2f}s)")
        stress_children = driver.execute_script("return window.app.mindmap.root.children.length;")
        test("23.2 All 50 stress children present", stress_children >= 50, f"(children: {stress_children})")
    run_section("SECTION 23: STRESS TEST (200 RAPID OPERATIONS)", section_23)

    # ============================================================
    def section_24():
        severe_errors = get_console_errors()
        test("24.1 No SEVERE browser console errors", len(severe_errors) == 0, f"(errors: {len(severe_errors)})")
        for err in severe_errors[:5]:
            msg = err.get('message', '')[:120]
            issues.append(f"CONSOLE ERROR: {msg}")
    run_section("SECTION 24: CONSOLE ERRORS CHECK", section_24)

    # ============================================================
    driver.save_screenshot(os.path.join(output_dir, "full_audit_evidence.png"))

    # ============================================================
    print("\n" + "=" * 80)
    passed = sum(1 for _, s, _ in results if s == "PASS")
    failed = sum(1 for _, s, _ in results if s == "FAIL")
    total = len(results)
    print(f"FULL AUDIT: {passed} PASSED, {failed} FAILED out of {total} tests")
    print("=" * 80)

    if issues:
        print("\n--- ISSUES REPORT ---")
        for issue in issues:
            print(f"  * {issue}")
    else:
        print("\nNo issues found. All features working correctly!")

except Exception as e:
    print(f"\nFATAL ERROR: {e}")
    import traceback
    traceback.print_exc()
    driver.save_screenshot(os.path.join(output_dir, "full_audit_crash.png"))

finally:
    driver.quit()

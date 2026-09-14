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

def run_test():
    passed = 0
    failed = 0

    def assert_test(name, condition, detail=""):
        nonlocal passed, failed
        if condition:
            print(f"  [PASS] {name} {detail}")
            passed += 1
        else:
            print(f"  [FAIL] {name} {detail}")
            failed += 1

    try:
        print("=" * 70)
        print("MINDFLOW SMART EDITOR (BULLETS, NUMBERING, TABS) VERIFICATION")
        print("=" * 70)

        driver.get("http://localhost:3000/")

        # Wait for app boot
        app_ready = False
        for _ in range(50):
            try:
                val = driver.execute_script("return Boolean(window.app && window.app.mindmap && window.app.mindmap.root);")
                if val:
                    app_ready = True
                    break
            except Exception:
                pass
            time.sleep(0.2)

        assert_test("MindFlow booted successfully", app_ready)

        # 1. Check presence of new toolbar buttons
        print("\n[1] Checking Toolbar Buttons in Right Editor...")
        btn_bullet = driver.find_element(By.ID, "right-fmt-bullet-list")
        btn_num = driver.find_element(By.ID, "right-fmt-numbered-list")
        btn_indent = driver.find_element(By.ID, "right-fmt-indent")
        btn_outdent = driver.find_element(By.ID, "right-fmt-outdent")

        assert_test("Bullet list button exists", btn_bullet is not None)
        assert_test("Numbered list button exists", btn_num is not None)
        assert_test("Indent (Tab) button exists", btn_indent is not None)
        assert_test("Outdent (Shift+Tab) button exists", btn_outdent is not None)

        # 2. Open Right Editor Panel for Root Node
        print("\n[2] Testing Right Editor Smart Typing...")
        driver.execute_script("""
            const root = window.app.mindmap.root;
            window.app.openRightEditorPanel(root.id);
        """)
        time.sleep(0.3)

        editor_el = driver.find_element(By.ID, "right-editor-content")
        panel_el = driver.find_element(By.ID, "right-editor-panel")
        assert_test("Right editor panel opened", "open" in panel_el.get_attribute("class"))

        # Test Tab key for fast spacing
        tab_result = driver.execute_script(r"""
            const el = document.getElementById('right-editor-content');
            el.focus();
            el.innerHTML = '';
            
            // Dispatch Tab key event
            const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
            el.dispatchEvent(tabEvent);
            
            // Type text after Tab
            document.execCommand('insertText', false, 'Indented text');
            
            return {
                text: el.innerText,
                extracted: window.app.renderer.extractTextWithNewlines(el)
            };
        """)
        assert_test("Tab key inserts 4 spaces (fast spacing)", "    Indented text" in tab_result['text'], f"got: {tab_result['text']!r}")

        # Test Markdown trigger: "* " converts to "• "
        print("\n[3] Testing Markdown Auto-Trigger (* + Space -> • )...")
        trigger_result = driver.execute_script(r"""
            const el = document.getElementById('right-editor-content');
            el.focus();
            el.innerHTML = '';
            
            // Type "*"
            document.execCommand('insertText', false, '*');
            // Press Space key
            const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
            el.dispatchEvent(spaceEvent);
            
            // Type "Task 1"
            document.execCommand('insertText', false, 'Task 1');
            
            return {
                text: el.innerText
            };
        """)
        assert_test("Typing '*' + Space auto-converts to bullet '• '", "• Task 1" in trigger_result['text'], f"got: {trigger_result['text']!r}")

        # Test Smart Enter continuation
        print("\n[4] Testing Smart Enter on Bullet and Numbered lists...")
        enter_bullet_result = driver.execute_script(r"""
            const el = document.getElementById('right-editor-content');
            el.focus();
            el.innerHTML = '';
            
            // Type "• Item 1"
            document.execCommand('insertText', false, '• Item 1');
            
            // Press Enter
            el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
            
            // Type "Item 2"
            document.execCommand('insertText', false, 'Item 2');
            
            // Press Enter on Item 2
            el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
            
            // Press Enter on empty bullet -> should exit list
            el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
            
            // Type normal text
            document.execCommand('insertText', false, 'Finished list');
            
            return {
                text: el.innerText,
                extracted: window.app.renderer.extractTextWithNewlines(el)
            };
        """)
        assert_test("Enter continues bullet list", "• Item 1\n• Item 2" in enter_bullet_result['text'], f"got: {enter_bullet_result['text']!r}")
        assert_test("Enter on empty bullet exits list", "Finished list" in enter_bullet_result['text'] and not "• Finished list" in enter_bullet_result['text'], f"got: {enter_bullet_result['text']!r}")

        # Test Numbered List: "1. Step 1" -> Enter -> "2. Step 2" -> Enter -> Exit
        enter_num_result = driver.execute_script(r"""
            const el = document.getElementById('right-editor-content');
            el.focus();
            el.innerHTML = '';
            
            document.execCommand('insertText', false, '1. First step');
            el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
            document.execCommand('insertText', false, 'Second step');
            el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
            // Exit list
            el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
            document.execCommand('insertText', false, 'Summary');
            
            return {
                text: el.innerText
            };
        """)
        assert_test("Enter increments numbered list 1. -> 2.", "1. First step\n2. Second step" in enter_num_result['text'], f"got: {enter_num_result['text']!r}")
        assert_test("Enter on empty number exits list", "Summary" in enter_num_result['text'] and not "3. Summary" in enter_num_result['text'], f"got: {enter_num_result['text']!r}")

        # 5. Test Toolbar Buttons Click
        print("\n[5] Testing Toolbar Action Buttons...")
        btn_bullet_toggle = driver.execute_script(r"""
            const el = document.getElementById('right-editor-content');
            el.focus();
            el.innerHTML = 'Alpha<br>Beta<br>Gamma';
            
            // Select all
            const sel = window.getSelection();
            const r = document.createRange();
            r.selectNodeContents(el);
            sel.removeAllRanges();
            sel.addRange(r);
            
            // Click bullet button
            document.getElementById('right-fmt-bullet-list').click();
            const withBullets = el.innerText;
            
            // Select all again and toggle OFF
            const r2 = document.createRange();
            r2.selectNodeContents(el);
            sel.removeAllRanges();
            sel.addRange(r2);
            document.getElementById('right-fmt-bullet-list').click();
            const withoutBullets = el.innerText;
            
            return { withBullets, withoutBullets };
        """)
        assert_test("Toolbar bullet button adds bullets to selection", "• Alpha\n• Beta\n• Gamma" in btn_bullet_toggle['withBullets'], f"got: {btn_bullet_toggle['withBullets']!r}")
        assert_test("Toolbar bullet button toggles bullets off", "•" not in btn_bullet_toggle['withoutBullets'], f"got: {btn_bullet_toggle['withoutBullets']!r}")

        btn_num_toggle = driver.execute_script(r"""
            const el = document.getElementById('right-editor-content');
            el.focus();
            el.innerHTML = 'One<br>Two<br>Three';
            
            const sel = window.getSelection();
            const r = document.createRange();
            r.selectNodeContents(el);
            sel.removeAllRanges();
            sel.addRange(r);
            
            // Click numbered list button
            document.getElementById('right-fmt-numbered-list').click();
            const withNums = el.innerText;
            
            return { withNums };
        """)
        assert_test("Toolbar numbered list button numbers lines sequentially", "1. One\n2. Two\n3. Three" in btn_num_toggle['withNums'], f"got: {btn_num_toggle['withNums']!r}")

        # 6. Apply to Node and Verify Canvas Rendering
        print("\n[6] Applying Formatted Text to Canvas Node...")
        driver.execute_script(r"""
            const root = window.app.mindmap.root;
            window.app.openRightEditorPanel(root.id);
            const el = document.getElementById('right-editor-content');
            el.focus();
            el.innerHTML = 'Project Plan:<br>• Research<br>&nbsp;&nbsp;&nbsp;&nbsp;• Sub-task A<br>1. Launch';
            document.getElementById('btn-apply-right-editor').click();
        """)
        time.sleep(0.3)

        root_node_text = driver.execute_script(r"""
            const root = window.app.mindmap.root;
            const el = window.app.renderer.nodeElements.get(root.id);
            const textSpan = el ? el.querySelector('.node-text') : null;
            return {
                nodeText: root.text,
                domHtml: textSpan ? textSpan.innerHTML : '',
                domText: textSpan ? textSpan.innerText : ''
            };
        """)
        assert_test("Root node has saved formatted bullet text", "• Research" in root_node_text['nodeText'], f"got: {root_node_text['nodeText']!r}")
        assert_test("Root node DOM displays bullets correctly", "• Research" in root_node_text['domText'], f"got: {root_node_text['domText']!r}")

        # 7. Test In-place Canvas Node Editing with Tab
        print("\n[7] Testing In-place Canvas Node Editing (Tab key)...")
        canvas_tab_result = driver.execute_script(r"""
            const root = window.app.mindmap.root;
            window.app.renderer.startEditing(root.id);
            const el = window.app.renderer.nodeElements.get(root.id);
            const textSpan = el.querySelector('.node-text');
            
            // Press Tab in textSpan
            const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
            textSpan.dispatchEvent(tabEvent);
            document.execCommand('insertText', false, 'Canvas Tab Text');
            
            const isStillEditing = el.classList.contains('editing');
            const resultText = textSpan.innerText;
            
            // Stop editing and save
            window.app.renderer.stopEditing(root.id, true);
            
            return {
                isStillEditing,
                resultText,
                savedNodeText: root.text
            };
        """)
        assert_test("Tab during canvas editing does not exit edit mode", canvas_tab_result['isStillEditing'])
        assert_test("Tab inserts 4 spaces in canvas node editing", "    " in canvas_tab_result['savedNodeText'])

        # 8. Test Color and Highlight Switching Without Sticking
        print("\n[8] Testing Color and Highlight Switching Without Sticking...")
        color_switch_result = driver.execute_script(r"""
            const root = window.app.mindmap.root;
            window.app.openRightEditorPanel(root.id);
            const el = document.getElementById('right-editor-content');
            el.focus();
            el.innerHTML = 'Hello World';

            // Select "World"
            const sel = window.getSelection();
            const r = document.createRange();
            r.setStart(el.firstChild, 6);
            r.setEnd(el.firstChild, 11);
            sel.removeAllRanges();
            sel.addRange(r);

            // 1. Click Red swatch
            document.querySelector('#right-color-palette .palette-swatch[data-color="#EF4444"]').click();
            const redHtml = el.innerHTML;

            // 2. Select "World" again and click Blue swatch
            const coloredSpan = el.querySelector('span');
            const r2 = document.createRange();
            r2.selectNodeContents(coloredSpan);
            sel.removeAllRanges();
            sel.addRange(r2);
            document.querySelector('#right-color-palette .palette-swatch[data-color="#3B82F6"]').click();
            const blueHtml = el.innerHTML;

            // 3. Select it again and click "Default" (inherit)
            const blueSpan = el.querySelector('span');
            const r3 = document.createRange();
            r3.selectNodeContents(blueSpan);
            sel.removeAllRanges();
            sel.addRange(r3);
            document.querySelector('#right-color-palette .palette-swatch[data-color="inherit"]').click();
            const defaultHtml = el.innerHTML;

            return { redHtml, blueHtml, defaultHtml };
        """)
        assert_test("Text colored with Red", "#EF4444" in color_switch_result['redHtml'] or "rgb(239, 68, 68)" in color_switch_result['redHtml'], f"got: {color_switch_result['redHtml']!r}")
        assert_test("Text cleanly switched from Red to Blue (no stuck red)", "#3B82F6" in color_switch_result['blueHtml'] or "rgb(59, 130, 246)" in color_switch_result['blueHtml'], f"got: {color_switch_result['blueHtml']!r}")
        assert_test("Red color does not persist in blue html", "#EF4444" not in color_switch_result['blueHtml'] and "239, 68, 68" not in color_switch_result['blueHtml'], f"got: {color_switch_result['blueHtml']!r}")
        assert_test("Color resets to default when clicking inherit", "style=" not in color_switch_result['defaultHtml'], f"got: {color_switch_result['defaultHtml']!r}")

        # 9. Check Console Logs for Errors
        print("\n[9] Checking Browser Console for JS Errors...")
        logs = driver.get_log('browser')
        severe_errors = [l for l in logs if l['level'] == 'SEVERE' and 'favicon' not in l['message']]
        assert_test("No severe browser console errors", len(severe_errors) == 0, f"errors: {severe_errors}")

        print("\n" + "=" * 70)
        print(f"VERIFICATION SUMMARY: {passed} PASSED, {failed} FAILED")
        print("=" * 70)

        return failed == 0

    finally:
        driver.quit()

if __name__ == '__main__':
    success = run_test()
    sys.exit(0 if success else 1)

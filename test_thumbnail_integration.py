import time
import sys
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

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
        print("GOOGLE DRIVE THUMBNAIL & INDEXABLE TEXT TEST SUITE")
        print("=" * 70)

        driver.get("http://127.0.0.1:3000/")
        for _ in range(50):
            ready = driver.execute_script("return !!(window.app && window.app.mindmap && window.app.mindmap.root);")
            if ready:
                break
            time.sleep(0.2)

        print("[1] App loaded. Adding test nodes with icons, notes, and long text to test wrapping...")
        driver.execute_script("""
            const root = window.app.mindmap.root;
            root.text = 'Root Node: MindFlow Project Overview with Long Title';
            
            // Add child 1 with long text to verify wrapping
            const c1 = window.app.mindmap.addChild(root.id, 'This is a very long subtopic description that should wrap properly across multiple lines within the node container width');
            if (c1) {
                window.app.mindmap.updateNode(c1.id, {
                    icon: '🚀',
                    notes: 'Detailed notes on this topic'
                });
            }
            
            // Add child 2 with custom color and notes
            const c2 = window.app.mindmap.addChild(root.id, 'Second subtopic with badge icons');
            if (c2) {
                window.app.mindmap.updateNode(c2.id, {
                    icon: '💡',
                    notes: 'Important consideration for Google Drive export'
                });
            }
            
            window.app.renderMap();
        """)
        time.sleep(0.5)

        # -------------------------------------------------------------
        # TEST 1: generateMapThumbnail(app)
        # -------------------------------------------------------------
        print("\n[TEST 1] Testing generateMapThumbnail(window.app)...")
        result = driver.execute_async_script("""
            const done = arguments[arguments.length - 1];
            (async () => {
                try {
                    const { generateMapThumbnail, blobToBase64Url, buildIndexableText, renderFallbackCard, fitUnderLimit } = await import('/js/thumbnail.js');
                    window.__thumbModule = { generateMapThumbnail, blobToBase64Url, buildIndexableText, renderFallbackCard, fitUnderLimit };

                    const blob = await generateMapThumbnail(window.app);
                    window.__testBlob = blob;

                    done({
                        success: true,
                        size: blob.size,
                        type: blob.type
                    });
                } catch (err) {
                    done({ success: false, error: err.message || String(err) });
                }
            })();
        """)

        print(f"   generateMapThumbnail result: {result}")
        assert result.get("success"), f"generateMapThumbnail threw error: {result.get('error')}"
        size = result.get("size", 0)
        mime = result.get("type", "")

        print(f"   -> Blob size: {size} bytes ({round(size / 1024, 2)} KB)")
        print(f"   -> Blob mime: {mime}")

        assert size > 0, f"Expected blob size > 0, got {size}"
        assert mime in ("image/png", "image/jpeg"), f"Expected image/png or image/jpeg, got {mime}"
        assert size <= 1500000, f"Expected blob size <= 1,500,000 bytes, got {size}"
        print("   -> generateMapThumbnail verification: PASSED")

        # -------------------------------------------------------------
        # TEST 2: blobToBase64Url(blob)
        # -------------------------------------------------------------
        print("\n[TEST 2] Testing blobToBase64Url(blob)...")
        b64_result = driver.execute_async_script("""
            const done = arguments[arguments.length - 1];
            (async () => {
                try {
                    const { blobToBase64Url } = window.__thumbModule;
                    const b64 = await blobToBase64Url(window.__testBlob);
                    done({
                        success: true,
                        length: b64.length,
                        hasPlus: b64.includes('+'),
                        hasSlash: b64.includes('/'),
                        sample: b64.slice(0, 60)
                    });
                } catch (err) {
                    done({ success: false, error: err.message || String(err) });
                }
            })();
        """)

        print(f"   blobToBase64Url result: length={b64_result.get('length')}, sample={b64_result.get('sample')}...")
        assert b64_result.get("success"), f"blobToBase64Url failed: {b64_result.get('error')}"
        assert b64_result.get("length", 0) > 0, "Expected non-empty base64 string"
        assert not b64_result.get("hasPlus"), "Base64Url must not contain '+'"
        assert not b64_result.get("hasSlash"), "Base64Url must not contain '/'"
        print("   -> URL-safe Base64 (no '+' and no '/'): PASSED")

        # -------------------------------------------------------------
        # TEST 3: buildIndexableText(mindmap)
        # -------------------------------------------------------------
        print("\n[TEST 3] Testing buildIndexableText(mindmap)...")
        text_result = driver.execute_script("""
            const { buildIndexableText } = window.__thumbModule;
            const text = buildIndexableText(window.app.mindmap);
            return {
                text: text,
                length: text.length,
                hasRoot: text.includes('Root Node'),
                hasNotes: text.includes('Detailed notes')
            };
        """)

        print(f"   buildIndexableText: length={text_result.get('length')} chars")
        print(f"   Preview: {text_result.get('text')[:120]}...")
        assert text_result.get("length") > 0, "Indexable text is empty"
        assert text_result.get("length") <= 120000, "Indexable text exceeded 120000 characters limit"
        assert text_result.get("hasRoot"), "Indexable text missing root text"
        assert text_result.get("hasNotes"), "Indexable text missing node notes"
        print("   -> buildIndexableText verification: PASSED")

        # -------------------------------------------------------------
        # TEST 4: Fallback Card Generation
        # -------------------------------------------------------------
        print("\n[TEST 4] Testing renderFallbackCard & error resilience...")
        fallback_result = driver.execute_async_script("""
            const done = arguments[arguments.length - 1];
            (async () => {
                try {
                    const { renderFallbackCard, fitUnderLimit } = window.__thumbModule;
                    const canvas = renderFallbackCard('Fallback Test Map', 12);
                    const blob = await fitUnderLimit(canvas);
                    done({
                        success: true,
                        size: blob.size,
                        type: blob.type
                    });
                } catch (err) {
                    done({ success: false, error: err.message || String(err) });
                }
            })();
        """)

        print(f"   Fallback card result: {fallback_result}")
        assert fallback_result.get("success"), f"renderFallbackCard failed: {fallback_result.get('error')}"
        assert fallback_result.get("size") > 0, "Fallback card blob is empty"
        assert fallback_result.get("size") <= 1500000, "Fallback card exceeded 1.5MB"
        print("   -> Fallback card verification: PASSED")

        # -------------------------------------------------------------
        # TEST 5: Console error cleanliness
        # -------------------------------------------------------------
        print("\n[TEST 5] Checking browser console for SEVERE errors...")
        check_severe_logs(driver, "Thumbnail Test Run")
        print("   -> Console cleanliness: PASSED (0 SEVERE errors)")

        print("\n" + "=" * 70)
        print("ALL THUMBNAIL INTEGRATION TESTS PASSED SUCCESSFULLY!")
        print("=" * 70)

    finally:
        driver.quit()

if __name__ == '__main__':
    run_tests()

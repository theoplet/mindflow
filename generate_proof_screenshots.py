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
brain_dir = r"C:\Users\ADMIN\.gemini\antigravity\brain\bd98c8bb-de61-4e22-bbab-a309594e8dff"

try:
    print("=" * 70)
    print("GENERATING VISUAL PROOF SCREENSHOTS & ANTI-FREEZE AUDIT")
    print("=" * 70)

    driver.get("http://localhost:3000/")
    for _ in range(30):
        if driver.execute_script("return !!(window.app && window.app.mindmap && window.app.mindmap.root);"):
            break
        time.sleep(0.2)
    time.sleep(1)

    root_id = driver.execute_script("return window.app.mindmap.root.id;")

    # 1. Update Root Node with Multiline Text + Complex Formula + Linebreaks
    combined_content = r"""Giải thích phương trình vi phân nhiều dòng:
\[
\mathcal{F}(x,t)
=
\frac{\partial}{\partial t}
\left(
\int_{0}^{\infty}
e^{-\lambda t}
\sum_{n=1}^{\infty}
\frac{(-1)^n}{n!}
\left(
\frac{\partial^n u(x,t)}{\partial x^n}
\right)^2
\,d\lambda
\right)
+
\det
\begin{pmatrix}
\frac{\partial^2 u}{\partial x^2} &
\frac{\partial^2 u}{\partial x \partial t} \\
\frac{\partial^2 u}{\partial t \partial x} &
\frac{\partial^2 u}{\partial t^2}
\end{pmatrix}
=
\lim_{N\to\infty}
\sum_{k=1}^{N}
\frac{\sin(kx)}{k^2+\alpha^2}.
\]
Dòng 2: Phân tích các thành phần ma trận và tích phân
Dòng 3: Kết luận phương trình thỏa mãn điều kiện biên."""

    driver.execute_script("""
        const rootId = arguments[0];
        const text = arguments[1];
        window.app.mindmap.updateNode(rootId, { text: text });
        window.app.renderMap();
    """, root_id, combined_content)
    time.sleep(0.5)

    # 2. Add Line Text Label to Connector Line
    child_id = driver.execute_script("return window.app.mindmap.root.children[0].id;")
    driver.execute_script("""
        const childId = arguments[0];
        window.app.mindmap.updateNode(childId, { lineText: 'Quan hệ Phụ thuộc (10%)' });
        window.app.renderMap();
    """, child_id)
    time.sleep(0.5)

    # Capture Proof 1: Multiline Math Formula + Line Text + Dark Mode
    driver.save_screenshot(os.path.join(brain_dir, "proof_01_multiline_math.png"))
    print("  [SAVED] proof_01_multiline_math.png")

    # 3. Open Math Editor Modal with Live Preview
    driver.execute_script("window.app.mathEditor.open();")
    time.sleep(0.5)
    driver.save_screenshot(os.path.join(brain_dir, "proof_02_math_editor_modal.png"))
    print("  [SAVED] proof_02_math_editor_modal.png")

    # Close modal
    driver.execute_script("window.app.mathEditor.close();")
    time.sleep(0.3)

    # 4. Open Line Context Box to demonstrate Line Text editing
    driver.execute_script("""
        const rootId = arguments[0];
        const childId = arguments[1];
        window.app.handleLineClick(rootId, childId, { clientX: 450, clientY: 250 });
    """, root_id, child_id)
    time.sleep(0.5)

    driver.save_screenshot(os.path.join(brain_dir, "proof_03_line_context_box.png"))
    print("  [SAVED] proof_03_line_context_box.png")

    # 5. Anti-Freeze Stress Test: Run 300 Rapid Operations
    print("\n--- Running 300 Rapid Operations Anti-Freeze Stress Test ---")
    start_time = time.time()
    driver.execute_script("""
        for (let i = 0; i < 300; i++) {
          const root = window.app.mindmap.root;
          if (i % 3 === 0) {
            window.app.mindmap.addChild(root.id, 'Stress Node ' + i);
          } else if (i % 3 === 1) {
            const selected = window.app.mindmap.getSelectedNode();
            window.app.mindmap.selectNode(selected ? null : root.id);
          } else {
            window.app.undo();
            window.app.redo();
          }
        }
        window.app.renderMap();
    """)
    elapsed = time.time() - start_time
    print(f"  [PASS] 300 rapid operations executed smoothly in {elapsed:.2f} seconds (No Freeze!)")

    # Final Screenshot
    driver.save_screenshot(os.path.join(brain_dir, "proof_04_anti_freeze_success.png"))
    print("  [SAVED] proof_04_anti_freeze_success.png")

    print("\n" + "=" * 70)
    print("ALL VISUAL PROOF SCREENSHOTS GENERATED SUCCESSFULLY")
    print("=" * 70)

finally:
    driver.quit()

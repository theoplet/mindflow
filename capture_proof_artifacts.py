import os
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By

ARTIFACT_DIR = r"C:\Users\ADMIN\.gemini\antigravity-ide\brain\cb478293-a803-48f0-807d-32c3b2929038"
os.makedirs(ARTIFACT_DIR, exist_ok=True)

chrome_options = Options()
chrome_options.add_argument("--headless=new")
chrome_options.add_argument("--window-size=1600,1000")
chrome_options.add_argument("--disable-gpu")
chrome_options.add_argument("--no-sandbox")

driver = webdriver.Chrome(options=chrome_options)

try:
    print("Navigating to MindFlow...")
    driver.get("http://localhost:3000/")
    time.sleep(2)

    # 1. Notes Popover Proof
    driver.execute_script("""
        const root = window.app.mindmap.root;
        root.notes = "Đây là ghi chú chi tiết cho node gốc.\\nPopover giờ hiển thị ngay cạnh badge 📝 ở góc trên bên phải của node!";
        window.app._doRenderMap();
    """)
    time.sleep(0.5)

    badge = driver.find_element(By.CSS_SELECTOR, ".node-notes-badge")
    badge.click()
    time.sleep(0.5)

    proof1 = os.path.join(ARTIFACT_DIR, "proof_01_notes_popover.png")
    driver.save_screenshot(proof1)
    print(f"Captured: {proof1}")

    # 2. Text Alignment and Color Proof
    driver.execute_script("""
        // Close popover
        const popover = document.querySelector('.node-notes-popover');
        if (popover) popover.style.display = 'none';

        const root = window.app.mindmap.root;
        root.text = 'Tiêu Đề Canh Giữa & Màu Nổi Bật';
        root.textAlign = 'center';
        root.textColor = '#6366F1';
        window.app._doRenderMap();
        window.app.openRightEditorPanel(root.id);
    """)
    time.sleep(0.8)

    proof2 = os.path.join(ARTIFACT_DIR, "proof_02_text_align_and_color.png")
    driver.save_screenshot(proof2)
    print(f"Captured: {proof2}")

    # 3. Inline Image inside Text Proof
    driver.execute_script("""
        const child = window.app.mindmap.root.children[0];
        child.text = 'Văn bản có ảnh inline: <br><img src="data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'160\\' height=\\'80\\'><rect width=\\'160\\' height=\\'80\\' fill=\\'%236366f1\\' rx=\\'10\\'/><text x=\\'80\\' y=\\'45\\' fill=\\'white\\' font-size=\\'14\\' text-anchor=\\'middle\\' font-family=\\'sans-serif\\'>MindFlow Inline</text></svg>" class="inline-editor-image" style="width:160px;"><br>Tiếp tục dòng văn bản liền mạch.';
        window.app._doRenderMap();
        window.app.openRightEditorPanel(child.id);
    """)
    time.sleep(0.8)

    proof3 = os.path.join(ARTIFACT_DIR, "proof_03_inline_image.png")
    driver.save_screenshot(proof3)
    print(f"Captured: {proof3}")

    # 4. Free Line Connection Proof
    driver.execute_script("""
        window.app.closeRightEditorPanel();
        const mm = window.app.mindmap;
        const root1 = mm.root;
        const root2 = mm.addCentralTopic('Chủ Đề Độc Lập 2', 400, 50);
        const conn = mm.addConnection(root1.id, root2.id, {
            lineWidth: 3,
            lineDash: 'dashed',
            lineColor: '#06B6D4',
            lineArrow: 'both',
            lineText: 'Liên kết Tự Do (Free Line)'
        });
        window.app._doRenderMap();
        window.app.handleFreeConnectionClick(conn.id, { clientX: 350, clientY: 250 });
    """)
    time.sleep(0.8)

    proof4 = os.path.join(ARTIFACT_DIR, "proof_04_freeline_connection.png")
    driver.save_screenshot(proof4)
    print(f"Captured: {proof4}")

    print("All screenshots successfully captured!")

finally:
    driver.quit()

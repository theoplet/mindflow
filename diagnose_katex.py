import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

options = webdriver.ChromeOptions()
options.add_argument('--headless=new')
options.add_argument('--window-size=1600,1000')

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

try:
    driver.get("http://localhost:3000/")
    time.sleep(2)

    has_katex = driver.execute_script("return typeof window.katex !== 'undefined';")
    print(f"window.katex loaded: {has_katex}")

    if has_katex:
        res = driver.execute_script("return window.katex.renderToString('\\\\frac{a}{b}');")
        print(f"KaTeX test output: {res[:100]}...")
    else:
        print("KaTeX is NOT loaded. Checking script tag in DOM...")
        script_src = driver.execute_script("""
            const scripts = Array.from(document.querySelectorAll('script'));
            return scripts.map(s => s.src);
        """)
        print("Scripts in page:", script_src)

finally:
    driver.quit()

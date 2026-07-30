const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const contexts = browser.contexts();
  const page = contexts[0].pages()[0];
  
  const result = await page.evaluate(async () => {
    try {
      const res = await fetch('https://kisskh.co/api/DramaList/Episode/180526.png?sub=true');
      const text = await res.text();
      return { status: res.status, ok: res.ok, body: text.substring(0, 500) };
    } catch (e) {
      return { error: e.message };
    }
  });

  console.log(result);
  await browser.close();
})();

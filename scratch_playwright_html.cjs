const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const contexts = browser.contexts();
  const page = contexts[0].pages()[0];
  
  const content = await page.content();
  console.log(content.substring(0, 1500));

  await browser.close();
})();

const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const contexts = browser.contexts();
  const page = contexts[0].pages()[0];
  
  page.on('request', req => {
    if (req.url().includes('Episode/180526')) {
      console.log('[REQ]', req.method(), req.url(), req.headers());
    }
  });
  
  page.on('response', res => {
    if (res.url().includes('Episode/180526')) {
      console.log('[RES]', res.status(), res.url(), res.headers());
    }
  });

  await page.evaluate(async () => {
    try {
      await fetch('https://kisskh.co/api/DramaList/Episode/180526.png?sub=true');
    } catch (e) {}
  });

  await page.waitForTimeout(2000);
  await browser.close();
})();

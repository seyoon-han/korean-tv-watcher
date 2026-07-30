const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const contexts = browser.contexts();
  const page = contexts[0].pages()[0];
  
  page.on('console', msg => console.log('[APP]', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('[APP ERR]', err.message));

  // Find any text containing "Ep 1" or just click the first thing that looks clickable
  const clickable = await page.$$('text="K-Drama"');
  if (clickable.length > 0) {
    await clickable[0].click();
    await page.waitForTimeout(1000);
  }

  // Click the first drama
  const images = await page.$$('img');
  if (images.length > 0) {
    await images[1].click(); // index 1 because index 0 is probably logo or something
    await page.waitForTimeout(2000);
    
    // Click episode 1
    const ep1 = await page.$$('text="Ep 1"');
    if (ep1.length > 0) {
      await ep1[0].click();
      console.log('Clicked episode 1!');
      await page.waitForTimeout(5000);
    }
  }

  await browser.close();
})();

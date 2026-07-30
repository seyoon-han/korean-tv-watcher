const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const contexts = browser.contexts();
  const page = contexts[0].pages()[0];
  
  page.on('console', msg => console.log('[APP]', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('[APP ERR]', err.message));

  console.log('Attached! Clicking first drama...');
  // Wait for dramas to load
  await page.waitForTimeout(2000);
  
  // Click first drama card
  const cards = await page.$$('.aspect-\\[2\\/3\\]');
  if (cards.length > 0) {
    await cards[0].click();
    console.log('Clicked drama card. Waiting for modal...');
    await page.waitForTimeout(2000);
    
    // Click episode 1
    const eps = await page.$$('text="Ep 1"');
    if (eps.length > 0) {
      await eps[0].click();
      console.log('Clicked episode 1. Waiting for playback...');
      await page.waitForTimeout(5000);
    } else {
      console.log('No episode 1 found');
    }
  } else {
    console.log('No drama cards found');
  }

  await browser.close();
})();

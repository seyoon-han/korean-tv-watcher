const { _electron: electron } = require('playwright');
const path = require('path');

(async () => {
  console.log('Launching electron app...');
  const electronApp = await electron.launch({
    executablePath: require('electron'),
    args: ['.'],
    cwd: path.join(__dirname),
    env: { ...process.env, NODE_ENV: 'development' }
  });

  const window = await electronApp.firstWindow();
  
  window.on('console', msg => {
    console.log(`[BROWSER]: ${msg.text()}`);
  });

  console.log('Waiting for network idle...');
  await window.waitForLoadState('networkidle');

  console.log('Clicking on the first featured drama...');
  await window.waitForSelector('.group.relative.cursor-pointer');
  await window.click('.group.relative.cursor-pointer');
  
  console.log('Waiting for modal to load...');
  await window.waitForSelector('.aspect-video');
  
  console.log('Clicking Ep 1...');
  await window.waitForSelector('button:has-text("Ep 1")');
  await window.click('button:has-text("Ep 1")');
  
  console.log('Checking if video starts playing...');
  await window.waitForTimeout(5000);
  
  const videoState = await window.evaluate(() => {
    const v = document.querySelector('video');
    return v ? {
      paused: v.paused,
      currentTime: v.currentTime,
      duration: v.duration,
      networkState: v.networkState,
      readyState: v.readyState,
      src: v.src,
      error: v.error ? v.error.message : null
    } : null;
  });
  
  console.log('Video State:', videoState);
  
  await electronApp.close();
  console.log('Done.');
})();

const { app, BrowserWindow, session } = require('electron');

app.whenReady().then(() => {
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['*://*.kisskh.co/*'] },
    (details, callback) => {
      details.requestHeaders['Referer'] = 'https://kisskh.co/';
      details.requestHeaders['Origin'] = 'https://kisskh.co';
      callback({ requestHeaders: details.requestHeaders });
    }
  );

  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ['*://*.kisskh.co/*'] },
    (details, callback) => {
      details.responseHeaders['Access-Control-Allow-Origin'] = ['*'];
      callback({ responseHeaders: details.responseHeaders });
    }
  );

  const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: true, contextIsolation: false } });
  win.loadURL(`data:text/html,<html><body><script>
    fetch("https://kisskh.co/api/DramaList/Episode/180526.png?sub=true")
      .then(r => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .then(console.log)
      .catch(console.error);
  </script></body></html>`);
  
  win.webContents.on('console-message', (e, level, message) => {
    console.log('[BROWSER CONSOLE]:', message.substring(0, 500));
    app.quit();
  });
});

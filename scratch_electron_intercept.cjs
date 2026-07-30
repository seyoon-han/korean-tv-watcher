const { app, session } = require('electron');

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
  console.log("Ready");
  app.quit();
});

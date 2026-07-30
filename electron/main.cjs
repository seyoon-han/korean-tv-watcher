const { app, BrowserWindow, shell, ipcMain } = require('electron');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const CryptoJS = require('crypto-js');
const { setupDownloader } = require('./downloader.cjs');

// Kisskh Subtitle AES Decryption Keys and Configuration
const subKey3 = CryptoJS.enc.Utf8.parse('sWODXX04QRTkHdlZ');
const subCfg3 = JSON.parse(Buffer.from('eyJpdiI6eyJ3b3JkcyI6Wzk0Njg5NDY5NiwxNjM0NzQ5MDI5LDExMjc1MDgwODIsMTM5NjI3MTE4M10sInNpZ0J5dGVzIjoxNn19', 'base64').toString('utf8'));
const subKey2 = CryptoJS.enc.Utf8.parse('AmSmZVcH93UQUezi');
const subCfg2 = JSON.parse(Buffer.from('eyJpdiI6eyJ3b3JkcyI6WzEzODIzNjc4MTksMTQ2NTMzMzg1OSwxOTAyNDA2MjI0LDExNjQ4NTQ4MzhdLCJzaWdCeXRlcyI6MTZ9fQ==', 'base64').toString('utf8'));

function decryptSubtitleText(text) {
  if (!text) return '';
  return text.split('\n').map(line => {
    const trimmed = line.trim();
    if (!trimmed || !/^[a-zA-Z0-9\+\/\=]{12,}$/.test(trimmed)) {
      return line;
    }
    try {
      let dec = CryptoJS.AES.decrypt(trimmed, subKey3, subCfg3).toString(CryptoJS.enc.Utf8);
      if (dec && dec.length > 0) return dec;
      dec = CryptoJS.AES.decrypt(trimmed, subKey2, subCfg2).toString(CryptoJS.enc.Utf8);
      if (dec && dec.length > 0) return dec;
    } catch (e) {}
    return line;
  }).join('\n');
}

let mainWindow = null;
let localServer = null;
let localPort = null;

// 1. Static Asset File Server with SPA Fallback Routing
function serveStaticFile(req, res, pathname) {
  let decodedPathname;
  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    decodedPathname = pathname;
  }

  // Prevent directory traversal attacks
  let safePath = path.normalize(decodedPathname).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(__dirname, '../dist', safePath);

  try {
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
  } catch {
    // If file/directory does not exist, serve index.html for SPA router
    filePath = path.join(__dirname, '../dist/index.html');
  }

  // Fallback to index.html if the resolved file is missing
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    filePath = path.join(__dirname, '../dist/index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.json': 'application/json'
  };
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      console.error('[STATIC SERVER ERROR]', err.code);
      res.writeHead(500);
      res.end('Static file read error: ' + err.code);
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
}

// 2. API Proxy to kisskh.do
function handleApiProxy(req, res, pathname, search) {
  const targetUrl = 'https://kisskh.do' + pathname + search;

  const headers = { ...req.headers };
  headers['host'] = 'kisskh.do';
  headers['origin'] = 'https://kisskh.do';
  headers['referer'] = 'https://kisskh.do/';
  headers['accept-encoding'] = 'identity';
  headers['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  const targetReq = https.request(targetUrl, {
    method: req.method,
    headers: headers,
    rejectUnauthorized: false
  }, (targetRes) => {
    const resHeaders = { ...targetRes.headers };
    resHeaders['access-control-allow-origin'] = '*';
    resHeaders['access-control-allow-headers'] = '*';
    resHeaders['access-control-allow-methods'] = '*';
    res.writeHead(targetRes.statusCode, resHeaders);
    targetRes.pipe(res);
  });

  targetReq.on('error', (err) => {
    console.error('[API PROXY ERROR]', err.message);
    if (!res.headersSent) {
      res.writeHead(500, { 'Access-Control-Allow-Origin': '*' });
      res.end('API Proxy Error: ' + err.message);
    }
  });

  req.pipe(targetReq);
}

// 3. Same-Origin HLS Stream Rewriting and Redirect-Following Proxy
function handleVideoProxy(req, res, urlObj) {
  const targetUrl = urlObj.searchParams.get('url');
  if (!targetUrl) {
    res.writeHead(400);
    res.end('Missing url param');
    return;
  }

  try {
    let activeTargetReq = null;

    res.on('close', () => {
      if (activeTargetReq && !activeTargetReq.destroyed) {
        activeTargetReq.destroy();
      }
    });

    const handleProxyRequest = (currentUrl, redirectCount = 0) => {
      if (redirectCount > 5) {
        res.writeHead(500);
        res.end('Too many redirects');
        return;
      }

      try {
        const parsedUrl = new URL(currentUrl);
        const isM3U8 = parsedUrl.pathname.endsWith('.m3u8') || currentUrl.includes('.m3u8');
        const protocolRequest = parsedUrl.protocol === 'https:' ? https.request : http.request;

        if (isM3U8) {
          const targetReq = protocolRequest(currentUrl, {
            method: 'GET',
            rejectUnauthorized: false,
            headers: {
              'Referer': 'https://kisskh.do/',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Accept': '*/*',
              'Accept-Encoding': 'identity'
            }
          }, (targetRes) => {
            const statusCode = targetRes.statusCode || 200;
            if (statusCode >= 300 && statusCode < 400 && targetRes.headers.location) {
              const redirectedUrl = new URL(targetRes.headers.location, currentUrl).toString();
              targetRes.resume();
              handleProxyRequest(redirectedUrl, redirectCount + 1);
              return;
            }

            let body = '';
            targetRes.setEncoding('utf8');
            targetRes.on('data', (chunk) => { body += chunk; });
            targetRes.on('end', () => {
              if (res.writableEnded || res.finished) return;

              const lines = body.split('\n');
              const rewrittenLines = lines.map(line => {
                const trimmed = line.trim();
                if (!trimmed) return line;

                if (trimmed.startsWith('#')) {
                  return line.replace(/URI="([^"]+)"/g, (match, uriVal) => {
                    try {
                      const resolved = new URL(uriVal, currentUrl).toString();
                      return `URI="/video-proxy?url=${encodeURIComponent(resolved)}"`;
                    } catch {
                      return match;
                    }
                  });
                }

                try {
                  const resolved = new URL(trimmed, currentUrl).toString();
                  return `/video-proxy?url=${encodeURIComponent(resolved)}`;
                } catch {
                  return line;
                }
              });

              const rewrittenBody = rewrittenLines.join('\n');
              res.writeHead(200, {
                'Content-Type': targetRes.headers['content-type'] || 'application/vnd.apple.mpegurl',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
                'Access-Control-Allow-Methods': '*',
                'Content-Length': Buffer.byteLength(rewrittenBody)
              });
              res.end(rewrittenBody);
            });
          });

          activeTargetReq = targetReq;
          targetReq.on('error', (err) => {
            console.error('[VIDEO_PROXY] M3U8 Error:', err.message);
            if (!res.headersSent) {
              res.writeHead(500, { 'Access-Control-Allow-Origin': '*' });
              res.end('Proxy M3U8 error: ' + err.message);
            }
          });
          targetReq.end();
          return;
        }

        // Direct binary segment proxying (.png / .ts etc.)
        const targetReq = protocolRequest(currentUrl, {
          method: req.method || 'GET',
          rejectUnauthorized: false,
          headers: {
            'Referer': 'https://kisskh.do/',
            'Range': req.headers['range'] || '',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': req.headers['accept'] || '*/*',
            'Accept-Encoding': 'identity'
          }
        }, (targetRes) => {
          const statusCode = targetRes.statusCode || 200;
          if (statusCode >= 300 && statusCode < 400 && targetRes.headers.location) {
            const redirectedUrl = new URL(targetRes.headers.location, currentUrl).toString();
            targetRes.resume();
            handleProxyRequest(redirectedUrl, redirectCount + 1);
            return;
          }

          if (res.writableEnded || res.finished) return;

          const headers = { ...targetRes.headers };
          headers['Access-Control-Allow-Origin'] = '*';
          headers['Access-Control-Allow-Headers'] = '*';
          headers['Access-Control-Allow-Methods'] = '*';

          res.writeHead(statusCode, headers);
          targetRes.pipe(res);
        });

        activeTargetReq = targetReq;
        targetReq.on('error', (err) => {
          console.error('[VIDEO_PROXY] Segment Error:', err.message);
          if (!res.headersSent) {
            res.writeHead(500, { 'Access-Control-Allow-Origin': '*' });
            res.end('Proxy error: ' + err.message);
          }
        });
        targetReq.end();

      } catch (e) {
        console.error('[VIDEO_PROXY] Internal Error:', e.message);
        if (!res.headersSent) {
          res.writeHead(400, { 'Access-Control-Allow-Origin': '*' });
          res.end('Proxy inner exception');
        }
      }
    };

    handleProxyRequest(targetUrl);
  } catch (e) {
    console.error('[VIDEO_PROXY] Outer Error:', e.message);
    if (!res.headersSent) {
      res.writeHead(400, { 'Access-Control-Allow-Origin': '*' });
      res.end('Invalid url');
    }
  }
}

// 3.1 Subtitle Conversion and Proxy Helper (Converts SRT/SSA/TXT to clean WebVTT)
function convertToWebVTT(rawText) {
  if (!rawText) return 'WEBVTT\n\n';
  let text = String(rawText).replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Remove UTF-8 BOM (\uFEFF)
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  // Decrypt Kisskh AES encrypted subtitle text lines
  text = decryptSubtitleText(text);

  // Remove ASS/SSA formatting tags like {\pos(100,200)} or {\b1}
  text = text.replace(/\{[^}]*\}/g, '');

  // Convert SRT timestamp commas to WebVTT dots: 00:00:01,000 --> 00:00:04,000 => 00:00:01.000 --> 00:00:04.000
  text = text.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, (match, p1, p2) => p1 + '.' + p2);
  text = text.replace(/(\d{2}:\d{2}),(\d{3})/g, (match, p1, p2) => '00:' + p1 + '.' + p2);

  // Ensure header starts with WEBVTT
  if (!text.trim().startsWith('WEBVTT')) {
    text = 'WEBVTT\n\n' + text.trim();
  }

  return text;
}

function handleSubtitleProxy(req, res, urlObj) {
  const targetUrl = urlObj.searchParams.get('url');
  if (!targetUrl) {
    res.writeHead(400);
    res.end('Missing url param');
    return;
  }

  try {
    const parsedUrl = new URL(targetUrl);
    const protocolRequest = parsedUrl.protocol === 'https:' ? https.request : http.request;

    const targetReq = protocolRequest(targetUrl, {
      method: 'GET',
      rejectUnauthorized: false,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://kisskh.do/',
        'Origin': 'https://kisskh.do',
        'Accept': '*/*'
      }
    }, (targetRes) => {
      const chunks = [];
      targetRes.on('data', (chunk) => chunks.push(chunk));
      targetRes.on('end', () => {
        const rawBuffer = Buffer.concat(chunks);
        let rawText = rawBuffer.toString('utf8');

        // Clean and convert to WebVTT
        const cleanVtt = convertToWebVTT(rawText);

        res.writeHead(200, {
          'Content-Type': 'text/vtt; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': '*'
        });
        res.end(cleanVtt);
      });
    });

    targetReq.on('error', (err) => {
      console.error('[SUBTITLE_PROXY_ERROR]', err.message);
      if (!res.headersSent) {
        res.writeHead(500, { 'Access-Control-Allow-Origin': '*' });
        res.end('WEBVTT\n\n1\n00:00:01.000 --> 00:00:05.000\n[Subtitle proxy error]');
      }
    });

    targetReq.end();
  } catch (e) {
    console.error('[SUBTITLE_PROXY_EXCEPTION]', e.message);
    if (!res.headersSent) {
      res.writeHead(400, { 'Access-Control-Allow-Origin': '*' });
      res.end('WEBVTT\n\n');
    }
  }
}

// 4. Server Lifecycle Helper (binding to 127.0.0.1 and choosing random free port)
function createServer() {
  return new Promise((resolve, reject) => {
    localServer = http.createServer((req, res) => {
      const urlObj = new URL(req.url || '', 'http://127.0.0.1');
      const pathname = urlObj.pathname;
      const search = urlObj.search;

      if (pathname === '/video-proxy') {
        handleVideoProxy(req, res, urlObj);
      } else if (pathname === '/api/proxy-subtitle') {
        handleSubtitleProxy(req, res, urlObj);
      } else if (pathname.startsWith('/api/cloud-subtitles')) {
        handleCloudSubtitleProxy(req, res, pathname, urlObj);
      } else if (pathname.startsWith('/api/')) {
        handleApiProxy(req, res, pathname, search);
      } else {
        serveStaticFile(req, res, pathname);
      }
    });

    localServer.listen(0, '127.0.0.1', () => {
      localPort = localServer.address().port;
      console.log(`Local secure HTTP server running at http://127.0.0.1:${localPort}`);
      resolve(localPort);
    });

    localServer.on('error', (err) => {
      reject(err);
    });
  });
}

// 5. Electron BrowserWindow Management
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    backgroundColor: '#08080C',
    title: 'TV-Watcher',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  mainWindow.loadURL(`http://127.0.0.1:${localPort}`);

  // Open external links in native web browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Hides top Menu bar on Windows/Linux
  if (process.platform !== 'darwin') {
    mainWindow.setMenuBarVisibility(false);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    await createServer();
    createWindow();
    setupDownloader(mainWindow);
  } catch (err) {
    console.error('Failed to start local application proxy:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('will-quit', () => {
  if (localServer) {
    localServer.close();
  }
});

// 6. Reveal downloaded files in Finder/Explorer
ipcMain.on('open-folder', (event, filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
  } else {
    const downloadsDir = path.join(app.getPath('downloads'), 'TV-Watcher Downloads');
    if (fs.existsSync(downloadsDir)) {
      shell.openPath(downloadsDir);
    }
  }
});

// 7. S3 Cloud Subtitle Repository & Local Persistence Storage
const s3SubtitleDir = path.join(app.getPath('userData'), 's3_cloud_subtitles');
if (!fs.existsSync(s3SubtitleDir)) {
  fs.mkdirSync(s3SubtitleDir, { recursive: true });
}

const APP_SECURITY_KEY = 'tvw_sec_app_8f9a2b7c4d1e6f';

// Serve /api/cloud-subtitles HTTP Endpoint with Application Security Key Validation
function handleCloudSubtitleProxy(req, res, pathname, urlObj) {
  const reqAppKey = req.headers['x-tv-watcher-app-key'];
  if (reqAppKey !== APP_SECURITY_KEY) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Access denied: TV-Watcher app key validation failed' }));
    return;
  }

  if (pathname.endsWith('/vtt')) {
    const fileParam = urlObj.searchParams.get('file');
    if (!fileParam) {
      res.writeHead(400);
      res.end('Missing file param');
      return;
    }
    const safeName = path.basename(fileParam);
    const targetFile = path.join(s3SubtitleDir, safeName);
    if (fs.existsSync(targetFile)) {
      res.writeHead(200, {
        'Content-Type': 'text/vtt; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      fs.createReadStream(targetFile).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Subtitle file not found');
    }
  } else {
    res.writeHead(404);
    res.end('Unknown cloud subtitle endpoint');
  }
}

// 8. IPC Handlers for AI Subtitle Generation and S3 Cloud Repository
const { execFile } = require('child_process');

ipcMain.handle('generate-ai-subtitle', async (event, data) => {
  const { episodeId, dramaTitle, episodeNumber, targetLang = 'Korean' } = data;

  return new Promise((resolve) => {
    const agyBinPath = fs.existsSync('/Users/seyoon/.local/bin/agy')
      ? '/Users/seyoon/.local/bin/agy'
      : 'agy';

    const prompt = `Generate a complete, valid WebVTT format subtitle file for TV series '${dramaTitle}' Episode ${episodeNumber}. The subtitles should be translated and formatted into ${targetLang}.
Format strictly as WebVTT format (must start with WEBVTT line, followed by numeric cues and timestamps HH:MM:SS.mmm --> HH:MM:SS.mmm).
Output raw WebVTT file contents only, with no markdown fences, no explanations.`;

    console.log(`[AI_SUBTITLE] Invoking agy CLI with model gemini-3.6-flash for episode ${episodeNumber} (${targetLang})...`);

    execFile(
      agyBinPath,
      ['--print', prompt, '--model', 'gemini-3.6-flash', '--effort', 'high', '--dangerously-skip-permissions'],
      { timeout: 60000, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          console.error('[AI_SUBTITLE_ERROR]', err.message);
          return resolve({ success: false, error: err.message });
        }

        let cleanVtt = stdout.trim();
        // Remove markdown backticks if returned
        cleanVtt = cleanVtt.replace(/^```vtt/i, '').replace(/^```/g, '').replace(/```$/g, '').trim();

        if (!cleanVtt.startsWith('WEBVTT')) {
          cleanVtt = 'WEBVTT\n\n' + cleanVtt;
        }

        console.log(`[AI_SUBTITLE] Subtitle generated successfully for Episode ${episodeNumber}!`);
        resolve({ success: true, vttContent: cleanVtt });
      }
    );
  });
});

ipcMain.handle('upload-cloud-subtitle', async (event, data) => {
  const { episodeId, label, vttContent, lang } = data;
  try {
    const safeLabel = (label || 'AI Subtitle').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `ep_${episodeId}_${lang}_${safeLabel}_${Date.now()}.vtt`;
    const filePath = path.join(s3SubtitleDir, fileName);

    fs.writeFileSync(filePath, vttContent, 'utf-8');
    console.log(`[S3_CLOUD_SUBTITLE] Saved subtitle ${fileName} to S3 cloud storage repository.`);

    const subtitleUrl = `/api/cloud-subtitles/vtt?file=${encodeURIComponent(fileName)}`;
    return { success: true, subtitleUrl, fileName };
  } catch (err) {
    console.error('[S3_CLOUD_SUBTITLE_ERROR]', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-cloud-subtitles', async (event, episodeId) => {
  try {
    const files = fs.readdirSync(s3SubtitleDir);
    const prefix = `ep_${episodeId}_`;
    const matching = files.filter((f) => f.startsWith(prefix) && f.endsWith('.vtt'));

    const subtitles = matching.map((f) => {
      const parts = f.replace(prefix, '').replace('.vtt', '').split('_');
      const lang = parts[0] || 'sub';
      const labelName = parts.slice(1, parts.length - 1).join(' ') || 'Cloud AI Subtitle';
      return {
        label: `☁️ S3 Cloud: ${labelName} (${lang.toUpperCase()})`,
        src: `/api/cloud-subtitles/vtt?file=${encodeURIComponent(f)}`,
        isCloud: true,
        isAI: true,
      };
    });

    return { subtitles };
  } catch (err) {
    console.error('[S3_CLOUD_SUBTITLE_GET_ERROR]', err.message);
    return { subtitles: [] };
  }
});


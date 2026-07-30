const { ipcMain, app } = require('electron');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Queue variables
const queue = [];
let activeItem = null;

// Resolve download folder
const downloadsDir = path.join(app.getPath('downloads'), 'TV-Watcher Downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

// Fetch helper with redirect-following support
function fetchUrl(urlStr, headers = {}, responseType = 'buffer') {
  return new Promise((resolve, reject) => {
    const fetchWithRedirect = (currentUrl, redirectCount = 0) => {
      if (redirectCount > 5) {
        return reject(new Error('Too many redirects'));
      }

      let parsed;
      try {
        parsed = new URL(currentUrl);
      } catch (err) {
        return reject(new Error('Invalid URL: ' + currentUrl));
      }

      const protocol = parsed.protocol === 'https:' ? https : http;
      
      const reqHeaders = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://kisskh.do/',
        ...headers
      };

      const req = protocol.get(currentUrl, { headers: reqHeaders }, (res) => {
        const statusCode = res.statusCode || 200;
        if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
          const nextUrl = new URL(res.headers.location, currentUrl).toString();
          res.resume();
          fetchWithRedirect(nextUrl, redirectCount + 1);
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          res.resume();
          return reject(new Error(`Fetch failed, status: ${statusCode}`));
        }

        if (responseType === 'text') {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => body += chunk);
          res.on('end', () => resolve(body));
        } else {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => resolve(Buffer.concat(chunks)));
        }
      });

      req.on('error', (err) => {
        reject(err);
      });
    };

    fetchWithRedirect(urlStr);
  });
}

// Select best quality playlist from master m3u8
function selectBestPlaylist(masterBody, masterUrl) {
  const lines = masterBody.split('\n');
  let bestUrl = null;
  let bestBandwidth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXT-X-STREAM-INF')) {
      const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/);
      const bandwidth = bandwidthMatch ? parseInt(bandwidthMatch[1], 10) : 0;
      
      let nextLine = '';
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim() && !lines[j].trim().startsWith('#')) {
          nextLine = lines[j].trim();
          break;
        }
      }

      if (nextLine) {
        try {
          const resolvedUrl = new URL(nextLine, masterUrl).toString();
          if (bandwidth > bestBandwidth || bestUrl === null) {
            bestBandwidth = bandwidth;
            bestUrl = resolvedUrl;
          }
        } catch {
          // ignore parsing error
        }
      }
    }
  }

  if (!bestUrl) {
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && (trimmed.endsWith('.m3u8') || trimmed.includes('.m3u8'))) {
        try {
          return new URL(trimmed, masterUrl).toString();
        } catch {
          // ignore
        }
      }
    }
  }

  return bestUrl || masterUrl;
}

// Parse child playlist into keyInfo and segment URLs
function parseChildPlaylist(playlistBody, playlistUrl) {
  const lines = playlistBody.split('\n');
  const segments = [];
  let keyInfo = null;
  let mediaSequence = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXT-X-MEDIA-SEQUENCE')) {
      const match = line.match(/#EXT-X-MEDIA-SEQUENCE:(\d+)/);
      if (match) {
        mediaSequence = parseInt(match[1], 10);
      }
    }

    if (line.startsWith('#EXT-X-KEY')) {
      const methodMatch = line.match(/METHOD=([^,\s]+)/);
      const method = methodMatch ? methodMatch[1] : null;

      if (method === 'AES-128') {
        const uriMatch = line.match(/URI="([^"]+)"/);
        const uri = uriMatch ? new URL(uriMatch[1], playlistUrl).toString() : null;

        const ivMatch = line.match(/IV=0x([a-fA-F0-9]+)/);
        const ivHex = ivMatch ? ivMatch[1] : null;

        keyInfo = {
          uri,
          iv: ivHex ? Buffer.from(ivHex, 'hex') : null
        };
      }
    }

    if (!line.startsWith('#')) {
      try {
        const segmentUrl = new URL(line, playlistUrl).toString();
        segments.push({
          url: segmentUrl,
          seqNumber: mediaSequence + segments.length
        });
      } catch {
        // ignore
      }
    }
  }

  return { keyInfo, segments };
}

// Calculate IV if it's based on sequence number
function getSegmentIV(seqNumber) {
  const iv = Buffer.alloc(16);
  iv.writeUInt32BE(seqNumber, 12);
  return iv;
}

// Start processing queue
async function processQueue(mainWindow) {
  if (activeItem || queue.length === 0) return;

  activeItem = queue.shift();
  const { episodeId, episodeNumber, dramaTitle, streamUrl } = activeItem;

  const safeDramaTitle = dramaTitle.replace(/[\\/:*?"<>|]/g, '_');
  const targetFileName = `${safeDramaTitle} - Episode ${episodeNumber}.mp4`;
  const targetFilePath = path.join(downloadsDir, targetFileName);

  console.log(`[DOWNLOADER] Starting download for ${targetFileName}`);

  // Create temporary directory for chunks
  const tempDir = path.join(downloadsDir, `temp_${episodeId}_${Date.now()}`);
  
  try {
    fs.mkdirSync(tempDir, { recursive: true });

    // Step A. Fetch playlist and child stream
    const masterBody = await fetchUrl(streamUrl, {}, 'text');
    const childUrl = selectBestPlaylist(masterBody, streamUrl);
    
    // Step B. Fetch child playlist
    const childBody = await fetchUrl(childUrl, {}, 'text');
    const { keyInfo, segments } = parseChildPlaylist(childBody, childUrl);

    if (segments.length === 0) {
      throw new Error('No video segments found in stream playlist');
    }

    // Step C. Fetch AES Key if exists
    let keyBuffer = null;
    if (keyInfo && keyInfo.uri) {
      console.log(`[DOWNLOADER] Fetching AES key from: ${keyInfo.uri}`);
      keyBuffer = await fetchUrl(keyInfo.uri, {}, 'buffer');
    }

    // Step D. Download segments in parallel batches
    const total = segments.length;
    let completed = 0;
    const concurrency = 6;
    let segmentIndex = 0;

    const downloadWorker = async () => {
      while (segmentIndex < total) {
        const currentIdx = segmentIndex++;
        const segment = segments[currentIdx];
        const tempPartPath = path.join(tempDir, `part_${currentIdx}.ts`);

        let success = false;
        let retries = 3;

        while (!success && retries > 0) {
          try {
            const segmentData = await fetchUrl(segment.url, {}, 'buffer');
            
            let finalData = segmentData;
            if (keyInfo && keyBuffer) {
              const iv = keyInfo.iv || getSegmentIV(segment.seqNumber);
              const decipher = crypto.createDecipheriv('aes-128-cbc', keyBuffer, iv);
              finalData = Buffer.concat([decipher.update(segmentData), decipher.final()]);
            }

            fs.writeFileSync(tempPartPath, finalData);
            success = true;
          } catch (err) {
             retries--;
             if (retries === 0) {
               throw new Error(`Failed to download segment ${currentIdx}: ${err.message}`);
             }
             await new Promise(r => setTimeout(r, 1000));
          }
        }

        completed++;
        const percent = Math.round((completed / total) * 100);
        
        // Report progress back via IPC (throttle progress reports to every 1% change)
        if (completed % Math.max(1, Math.round(total / 100)) === 0 || completed === total) {
          mainWindow.webContents.send('download-progress', { episodeId, progress: percent });
        }
      }
    };

    // Run parallel workers
    const workers = Array(Math.min(concurrency, total)).fill(null).map(() => downloadWorker());
    await Promise.all(workers);

    // Step E. Concatenate all decrypted TS parts into the final target file
    const writeStream = fs.createWriteStream(targetFilePath);
    for (let i = 0; i < total; i++) {
      const partPath = path.join(tempDir, `part_${i}.ts`);
      if (fs.existsSync(partPath)) {
        const partData = fs.readFileSync(partPath);
        writeStream.write(partData);
        fs.unlinkSync(partPath); // delete temp part file
      }
    }
    writeStream.end();

    console.log(`[DOWNLOADER] Download completed: ${targetFilePath}`);
    mainWindow.webContents.send('download-completed', { episodeId, filePath: targetFilePath });

  } catch (err) {
    console.error(`[DOWNLOADER] Download failed for Episode ${episodeNumber}:`, err.message);
    mainWindow.webContents.send('download-failed', { episodeId, error: err.message });
    
    // Attempt cleanup
    try {
      if (fs.existsSync(targetFilePath)) {
        fs.unlinkSync(targetFilePath);
      }
    } catch {
      // ignore
    }
  } finally {
    // Clean up temp directory
    try {
      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        for (const file of files) {
          fs.unlinkSync(path.join(tempDir, file));
        }
        fs.rmdirSync(tempDir);
      }
    } catch {
      // ignore
    }

    activeItem = null;
    // Process next item
    setTimeout(() => processQueue(mainWindow), 500);
  }
}

function setupDownloader(mainWindow) {
  ipcMain.on('download-episode', (event, data) => {
    const { episodeId, episodeNumber, dramaId, dramaTitle, streamUrl } = data;
    
    // Check if duplicate in queue or active item
    const duplicate = queue.find(item => item.episodeId === episodeId) || (activeItem && activeItem.episodeId === episodeId);
    if (duplicate) {
      console.log(`[DOWNLOADER] Episode ${episodeId} already in queue or active.`);
      return;
    }

    console.log(`[DOWNLOADER] Queued download for Episode ${episodeNumber} (${dramaTitle})`);
    queue.push({ episodeId, episodeNumber, dramaId, dramaTitle, streamUrl });
    
    // Trigger queue processing
    processQueue(mainWindow);
  });
}

module.exports = { setupDownloader };

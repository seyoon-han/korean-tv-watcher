const http = require('http');
const https = require('https');

function handleApiProxy(req, res, pathname, search) {
  const targetUrl = 'https://kisskh.co' + pathname + search;

  const headers = { ...req.headers };
  headers['host'] = 'kisskh.co';
  headers['origin'] = 'https://kisskh.co';
  headers['referer'] = 'https://kisskh.co/';
  headers['accept-encoding'] = 'identity';
  headers['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  
  delete headers['connection'];

  const targetReq = https.request(targetUrl, {
    method: req.method,
    headers: headers,
    rejectUnauthorized: false
  }, (targetRes) => {
    let b = '';
    targetRes.on('data', c => b += c);
    targetRes.on('end', () => console.log('Proxy target response:', targetRes.statusCode, b.slice(0, 100)));
    
    const resHeaders = { ...targetRes.headers };
    resHeaders['access-control-allow-origin'] = '*';
    res.writeHead(targetRes.statusCode, resHeaders);
    targetRes.pipe(res);
  });

  targetReq.on('error', (err) => {
    res.writeHead(500);
    res.end(err.message);
  });

  req.pipe(targetReq);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  handleApiProxy(req, res, url.pathname, url.search);
});

server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  console.log(`Server listening on ${port}`);
  
  http.get(`http://127.0.0.1:${port}/api/DramaList/Episode/180526.png?sub=true`, {
    headers: {
      'User-Agent': 'Mozilla/5.0'
    }
  }, (res) => {
    let b = '';
    res.on('data', c => b+=c);
    res.on('end', () => {
      console.log('Client response:', res.statusCode, b.slice(0, 100));
      server.close();
    });
  });
});

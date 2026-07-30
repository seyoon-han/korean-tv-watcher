const https = require('https');

https.get('https://kisskh.co/api/DramaList/Episode/180526.png?sub=true', {
  headers: {
    'Host': 'kisskh.co',
    'Origin': 'https://kisskh.co',
    'Referer': 'https://kisskh.co/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  }
}, (res) => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    if (res.statusCode === 200) {
      console.log('Body:', body.substring(0, 500));
    }
  });
}).on('error', console.error);

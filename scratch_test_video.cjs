const https = require('https');

https.get('https://kisskh.co/api/DramaList/Episode/180526.png?sub=true', {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  }
}, (res) => {
  let b = '';
  console.log('Status:', res.statusCode);
  res.on('data', c => b += c);
  res.on('end', () => console.log('Body length:', b.length));
});

// Minimal static file server for local preview: node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = Number(process.env.PORT) || 5173;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

http.createServer((req, res) => {
  // dev helper: POST a canvas data-URL to /__shot?name=x to save it under .shots/ (gitignored)
  if (req.method === 'POST' && req.url.startsWith('/__shot')) {
    const name = (new URL(req.url, 'http://x').searchParams.get('name') || 'shot').replace(/[^\w-]/g, '');
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      fs.mkdirSync(path.join(root, '.shots'), { recursive: true });
      fs.writeFileSync(path.join(root, '.shots', `${name}.jpg`), Buffer.from(body.split(',')[1] || '', 'base64'));
      res.writeHead(200); res.end('ok');
    });
    return;
  }
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(root, path.normalize(p));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, {
      'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
}).listen(port, () => console.log(`Rainy night scene: http://localhost:${port}`));

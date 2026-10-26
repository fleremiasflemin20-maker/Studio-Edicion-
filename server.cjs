const http = require('node:http'),
  fs = require('node:fs'),
  path = require('node:path');
const root = path.resolve(__dirname, 'dist'),
  port = Number(process.env.PORT) || 4173;
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};
http
  .createServer((req, res) => {
    try {
      if (!['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(405);
        return res.end();
      }
      const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
      if (!file.startsWith(root + path.sep)) {
        res.writeHead(403);
        return res.end();
      }
      fs.readFile(file, (err, data) => {
        if (err) {
          res.writeHead(404);
          return res.end('Not found');
        }
        res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(req.method === 'HEAD' ? undefined : data);
      });
    } catch {
      res.writeHead(400);
      res.end('Bad request');
    }
  })
  .listen(port, '127.0.0.1', () => console.log('Luma Studio: http://127.0.0.1:' + port));

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  let path = req.url?.split('?')[0] ?? '/';
  let file = path === '/' ? 'dist/index.html' : join('dist', path);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    const body = await readFile('dist/index.html');
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(body);
  }
});
server.listen(4173, () => console.log('preview on http://localhost:4173'));

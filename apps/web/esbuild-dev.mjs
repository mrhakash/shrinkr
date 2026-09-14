import { context } from 'esbuild';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { WebSocketServer } from 'node:http';

// Minimal dev server: esbuild ctx rebuild + fallback to index.html (SPA).
const ctx = await context({
  entryPoints: ['src/main.tsx'],
  bundle: true,
  outfile: 'dist-dev/main.js',
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"development"' },
  logLevel: 'info',
  sourcemap: 'inline',
});

await ctx.watch();

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  let path = req.url?.split('?')[0] ?? '/';
  if (path === '/') {
    const html = (await readFile('index.html', 'utf-8')).replace(
      '<script type="module" src="/src/main.tsx"></script>',
      '<script type="module" src="/main.js"></script>'
    );
    res.writeHead(200, { 'content-type': 'text/html' });
    return void res.end(html);
  }
  if (path === '/main.js') {
    const body = await readFile('dist-dev/main.js');
    res.writeHead(200, { 'content-type': 'text/javascript' });
    return void res.end(body);
  }
  if (path.startsWith('/api') || path.startsWith('/r/')) {
    const target = 'http://localhost:3000' + req.url;
    const resp = await fetch(target, {
      method: req.method,
      headers: req.headers.host ? { host: 'localhost:3000' } : {},
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req,
      redirect: 'manual',
    });
    res.writeHead(resp.status, Object.fromEntries(resp.headers.entries()));
    return void res.end(Buffer.from(await resp.arrayBuffer()));
  }
  res.writeHead(404);
  res.end('not found');
});
server.listen(5173, () => console.log('dev server on http://localhost:5173'));

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('dist');
const types = { '.html':'text/html', '.css':'text/css', '.mjs':'text/javascript', '.js':'text/javascript', '.svg':'image/svg+xml', '.png':'image/png', '.webmanifest':'application/manifest+json' };
http.createServer(async (req,res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const path = resolve(root, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
    if (!path.startsWith(root + sep)) throw Error('Invalid path');
    const content = await readFile(path);
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control':'no-cache', 'X-Content-Type-Options':'nosniff' }); res.end(content);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(4173,'127.0.0.1', () => console.log('FlowTrack: http://127.0.0.1:4173'));

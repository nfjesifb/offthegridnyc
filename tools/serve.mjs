// Minimal static file server for local preview and tests (mirrors GitHub Pages
// behaviour: directory index files, `foo` -> `foo.html`, custom 404.html).
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] || process.env.PORT || 4173);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.map': 'application/json',
};

function resolvePath(urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath.split('?')[0]); } catch { return null; }
  const full = normalize(join(root, p));
  if (full !== root && !full.startsWith(root + sep)) return null; // no traversal
  if (existsSync(full) && statSync(full).isDirectory()) {
    if (!p.endsWith('/')) return { redirect: p + '/' };
    const index = join(full, 'index.html');
    return existsSync(index) ? { file: index } : null;
  }
  if (existsSync(full)) return { file: full };
  if (existsSync(full + '.html')) return { file: full + '.html' };
  return null;
}

const server = http.createServer((req, res) => {
  const hit = resolvePath(req.url || '/');
  const headers = { 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' };
  if (hit && hit.redirect) {
    res.writeHead(301, { ...headers, Location: hit.redirect });
    return res.end();
  }
  let file = hit && hit.file;
  let status = 200;
  if (!file) {
    file = join(root, '404.html');
    status = 404;
    if (!existsSync(file)) { res.writeHead(404, headers); return res.end('Not found'); }
  }
  res.writeHead(status, { ...headers, 'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Serving ${root} at http://127.0.0.1:${port}/`);
});

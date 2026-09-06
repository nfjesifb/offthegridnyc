// Static verification of the generated site: internal links resolve, no secrets
// leaked, every page carries the security and SEO metadata we expect.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', '.git', 'templates', '.cache', 'test-results', 'playwright-report']);
const problems = [];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(root);
const htmlFiles = files.filter((f) => f.endsWith('.html'));
const self = fileURLToPath(import.meta.url);
const textFiles = files.filter((f) => f !== self && /\.(html|js|mjs|json|py|css|xml|txt|yml|md)$/.test(f));

// 1. Secrets: Google API keys or other credential-looking strings must never be published.
const secretPatterns = [/AIza[0-9A-Za-z_-]{30,}/, /sk-[A-Za-z0-9]{32,}/, /ghp_[A-Za-z0-9]{30,}/, /super_secret_key/i];
for (const f of textFiles) {
  const text = readFileSync(f, 'utf8');
  for (const re of secretPatterns) {
    if (re.test(text)) problems.push(`${relative(root, f)}: matches secret pattern ${re}`);
  }
}

// 2. Links and assets inside generated pages resolve to real files.
function exists(urlPath) {
  const clean = decodeURIComponent(urlPath.split(/[?#]/)[0]);
  if (!clean || clean === '/') return existsSync(join(root, 'index.html'));
  const full = join(root, clean);
  if (!full.startsWith(root + sep)) return false;
  if (existsSync(full)) return !statSync(full).isDirectory() || existsSync(join(full, 'index.html'));
  return existsSync(full + '.html');
}
const attrRe = /(?:href|src)="([^"]+)"/g;
const srcsetRe = /srcset="([^"]+)"/g;
for (const f of htmlFiles) {
  const html = readFileSync(f, 'utf8');
  const rel = relative(root, f);
  const refs = [];
  for (const m of html.matchAll(attrRe)) refs.push(m[1]);
  for (const m of html.matchAll(srcsetRe)) for (const part of m[1].split(',')) refs.push(part.trim().split(/\s+/)[0]);
  for (const ref of refs) {
    if (/^(https?:|mailto:|tel:|#|data:|javascript:)/.test(ref)) continue;
    if (!ref.startsWith('/')) { problems.push(`${rel}: relative URL "${ref}" (use root-relative URLs)`); continue; }
    if (!exists(ref)) problems.push(`${rel}: broken link ${ref}`);
  }
  const isRedirect = html.includes('http-equiv="refresh"');
  if (!isRedirect) {
    if (!html.includes('http-equiv="Content-Security-Policy"')) problems.push(`${rel}: missing CSP meta tag`);
    if (!/<link rel="canonical"/.test(html)) problems.push(`${rel}: missing canonical link`);
    if (!/<meta name="description"/.test(html)) problems.push(`${rel}: missing meta description`);
    if (/<script(?![^>]*\btype="application\/(ld\+)?json")[^>]*>\s*[^\s<]/.test(html)) problems.push(`${rel}: inline script (blocked by CSP)`);
    if (/\s(src|href)="http:\/\//.test(html)) problems.push(`${rel}: insecure http:// resource`);
    for (const m of html.matchAll(/<a [^>]*target="_blank"[^>]*>/g)) {
      if (!/rel="[^"]*noopener/.test(m[0])) problems.push(`${rel}: target=_blank link without rel=noopener: ${m[0].slice(0, 80)}`);
    }
  }
}

// 3. The public dataset and sitemap agree with the generated pages.
const dataset = JSON.parse(readFileSync(join(root, 'assets', 'data', 'locations.json'), 'utf8'));
const sitemap = readFileSync(join(root, 'sitemap.xml'), 'utf8');
for (const p of dataset.places) {
  const path = new URL(p.url).pathname;
  if (!exists(path)) problems.push(`dataset: ${path} has no page`);
  if (!sitemap.includes(`<loc>${p.url}</loc>`)) problems.push(`sitemap: missing ${p.url}`);
}

if (problems.length) {
  console.error(`✖ ${problems.length} problem(s):`);
  for (const p of problems.slice(0, 60)) console.error('  ' + p);
  if (problems.length > 60) console.error(`  … and ${problems.length - 60} more`);
  process.exit(1);
}
console.log(`✔ ${htmlFiles.length} pages checked: links resolve, no secrets, CSP and metadata present, dataset and sitemap consistent.`);

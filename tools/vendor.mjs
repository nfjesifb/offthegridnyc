// Copies pinned third-party assets from node_modules into assets/ so the
// published site never loads scripts, styles or fonts from a CDN.
import { cpSync, mkdirSync, copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const nm = join(root, 'node_modules');
const out = join(root, 'assets');

// Text files are written with LF line endings so the output is identical on
// every platform (the git diff check in CI depends on that).
function copyText(src, dest) {
  writeFileSync(dest, readFileSync(src, 'utf8').replace(/\r\n/g, '\n'));
}

function version(pkg) {
  return JSON.parse(readFileSync(join(nm, pkg, 'package.json'), 'utf8')).version;
}

// Leaflet (map library) - js, css and the control sprites.
const leafletOut = join(out, 'vendor', 'leaflet');
mkdirSync(leafletOut, { recursive: true });
for (const f of ['leaflet.js', 'leaflet.css']) {
  copyText(join(nm, 'leaflet', 'dist', f), join(leafletOut, f));
}
cpSync(join(nm, 'leaflet', 'dist', 'images'), join(leafletOut, 'images'), { recursive: true });
copyText(join(nm, 'leaflet', 'LICENSE'), join(leafletOut, 'LICENSE'));
console.log(`leaflet ${version('leaflet')} -> assets/vendor/leaflet`);

// Fonts (SIL Open Font License) - latin subsets only.
const fontsOut = join(out, 'fonts');
mkdirSync(fontsOut, { recursive: true });
const fonts = {
  '@fontsource/playfair-display': ['playfair-display-latin-400-normal.woff2', 'playfair-display-latin-700-normal.woff2'],
  '@fontsource/poppins': ['poppins-latin-400-normal.woff2', 'poppins-latin-500-normal.woff2', 'poppins-latin-600-normal.woff2'],
};
for (const [pkg, files] of Object.entries(fonts)) {
  for (const f of files) copyFileSync(join(nm, pkg, 'files', f), join(fontsOut, f));
  const lic = join(nm, pkg, 'LICENSE');
  if (existsSync(lic)) copyText(lic, join(fontsOut, `${pkg.split('/')[1]}-LICENSE`));
  console.log(`${pkg} ${version(pkg)} -> assets/fonts (${files.length} files)`);
}

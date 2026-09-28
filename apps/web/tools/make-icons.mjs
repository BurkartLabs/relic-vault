// Bakes the PWA icons from the same procedural painter the game uses, and (AB#4729) the Google Play store icon and
// feature graphic into screenshots/store/: the icon a 32-bit PNG, the feature graphic a 24-bit PNG (no alpha), as Play
// asks. The 24-bit conversion uses ffmpeg, which make-video.mjs needs too.
// Usage: node apps/web/tools/make-icons.mjs   (uses the installed Edge/Chrome via Playwright)
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const server = await createServer({ configFile: resolve(root, 'vite.config.ts'), server: { port: 5199 } });
await server.listen();
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' });
const page = await browser.newPage();
await page.goto('http://localhost:5199/tools/icons.html');
await page.waitForFunction(() => window.__icons);
const icons = await page.evaluate(() => window.__icons);
const out = resolve(root, 'public/icons');
mkdirSync(out, { recursive: true });
for (const [name, url] of Object.entries(icons)) {
  writeFileSync(resolve(out, name), Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote', name);
}
// AB#4729: the store's icon and feature graphic
await page.waitForFunction(() => window.__store);
const store = await page.evaluate(() => window.__store);
const storeDir = resolve(root, 'screenshots/store');
mkdirSync(storeDir, { recursive: true });
for (const [name, url] of Object.entries(store)) {
  const file = resolve(storeDir, name);
  writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  if (name.startsWith('feature')) {
    const tmp = file + '.rgba.png';
    writeFileSync(tmp, Buffer.from(url.split(',')[1], 'base64'));
    const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', tmp, '-pix_fmt', 'rgb24', file]);
    rmSync(tmp);
    if (r.status !== 0) throw new Error(`ffmpeg: ${r.stderr}`);
  }
  console.log('wrote screenshots/store/' + name);
}
await browser.close();
await server.close();

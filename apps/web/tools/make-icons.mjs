// Bakes the PWA icons from the same procedural painter the game uses.
// Usage: node apps/web/tools/make-icons.mjs   (uses the installed Edge/Chrome via Playwright)
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
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
await browser.close();
await server.close();

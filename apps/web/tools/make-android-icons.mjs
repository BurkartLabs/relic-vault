// AB#4723: the Android launcher icons and splash icon, from the PWA's own icons (public/icons, baked by
// make-icons.mjs), drawn in the browser as make-icons.mjs does. Writes into android/app/src/main/res.
// Usage: node apps/web/tools/make-android-icons.mjs   (uses the installed Edge/Chrome via Playwright)
//
// - ic_launcher / ic_launcher_round: icon-512, square and circle, for launchers that do not use adaptive icons.
// - ic_launcher_foreground: the adaptive icon's front layer (108 dp). The maskable icon's safe zone (the middle 80%)
//   is fitted to the 66 dp every launcher mask keeps; the back layer is @color/ic_launcher_background (#07060B).
// - splash_icon: Android 12's splash icon (288 dp, the middle 192 dp circle shown). The maskable icon's safe zone is
//   fitted to that circle, on a transparent canvas; the splash's background is @color/vault_bg.
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const res = resolve(root, 'android/app/src/main/res');
const dataUrl = (file) => `data:image/png;base64,${readFileSync(resolve(root, 'public/icons', file)).toString('base64')}`;
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const SAFE = 0.8; // a maskable icon's safe zone, as a share of its side (W3C maskable icons)

// Each output: [folder, file, canvas px, drawn px, source, circle clip]
const jobs = [];
for (const [d, k] of Object.entries(DENSITIES)) {
  const legacy = Math.round(48 * k);
  jobs.push([`mipmap-${d}`, 'ic_launcher.png', legacy, legacy, 'icon-512.png', false]);
  jobs.push([`mipmap-${d}`, 'ic_launcher_round.png', legacy, legacy, 'icon-512.png', true]);
  jobs.push([`mipmap-${d}`, 'ic_launcher_foreground.png', Math.round(108 * k), Math.round((66 / SAFE) * k), 'icon-maskable-512.png', false]);
}
jobs.push(['drawable-xxhdpi', 'splash_icon.png', 288 * 3, Math.round((192 / SAFE) * 3), 'icon-maskable-512.png', false]);

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' });
const page = await browser.newPage();
const sources = { 'icon-512.png': dataUrl('icon-512.png'), 'icon-maskable-512.png': dataUrl('icon-maskable-512.png') };
const out = await page.evaluate(async ({ jobs, sources }) => {
  const images = {};
  for (const [name, url] of Object.entries(sources)) {
    const img = new Image();
    img.src = url;
    await img.decode();
    images[name] = img;
  }
  // the maskable icon's corner colour, which the adaptive icon's back layer must match
  const probe = document.createElement('canvas');
  probe.width = probe.height = 512;
  const pc = probe.getContext('2d');
  pc.drawImage(images['icon-maskable-512.png'], 0, 0);
  const [r, g, b] = pc.getImageData(2, 2, 1, 1).data;
  const corner = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  const files = jobs.map(([folder, file, size, drawn, source, circle]) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = true;
    x.imageSmoothingQuality = 'high';
    if (circle) { x.beginPath(); x.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); x.clip(); }
    const at = (size - drawn) / 2;
    x.drawImage(images[source], at, at, drawn, drawn);
    return [folder, file, c.toDataURL('image/png')];
  });
  return { corner, files };
}, { jobs, sources });

for (const [folder, file, url] of out.files) {
  mkdirSync(resolve(res, folder), { recursive: true });
  writeFileSync(resolve(res, folder, file), Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote', `${folder}/${file}`);
}
console.log(`the maskable icon's corner is ${out.corner}; @color/ic_launcher_background should match it`);
await browser.close();

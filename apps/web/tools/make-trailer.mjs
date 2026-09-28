// AB#4729: cuts video/trailer.mp4, the Play store / YouTube trailer, from video/trailer.json: a title card, footage
// trims named by video/segments.json (a segment and one of its clips), and an end card. 1080x1920, 30 fps, 25 to 32 seconds, a silent AAC track (Play
// and YouTube accept a trailer with no sound). No caption is burned in; video/trailer.vtt carries each shot's caption,
// for YouTube's upload. Fails if the cut comes out outside 25 to 32 seconds.
// Usage: node apps/web/tools/record.mjs <url> video/build/raw   (fresh footage of the current build)
//        node apps/web/tools/make-trailer.mjs [rawDir]           (default video/build/raw)
import { chromium } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '../../..');
const vdir = join(root, 'video');
const rawDir = resolve(root, process.argv[2] || 'video/build/raw');
const build = join(vdir, 'build', 'trailer');
rmSync(build, { recursive: true, force: true });
mkdirSync(build, { recursive: true });
const { shots } = JSON.parse(readFileSync(join(vdir, 'trailer.json'), 'utf8'));
const segments = JSON.parse(readFileSync(join(vdir, 'segments.json'), 'utf8'));

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`${cmd} failed: ${r.stderr?.slice(-2000)}`);
  return r.stdout;
};
const dur = (f) => parseFloat(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]));

// ---------- the two cards, in the game's type (as make-video.mjs draws its slates)
const font = (p) => pathToFileURL(join(root, 'node_modules/@fontsource', p)).href;
const icon = pathToFileURL(join(root, 'public/icons/icon-512.png')).href;
const cardHtml = (kind) => `<!doctype html><html><head><style>
  @font-face{font-family:Cinzel;font-weight:900;src:url(${font('cinzel/files/cinzel-latin-900-normal.woff2')})}
  @font-face{font-family:Oswald;font-weight:500;src:url(${font('oswald/files/oswald-latin-500-normal.woff2')})}
  html,body{margin:0;width:1080px;height:1920px;overflow:hidden}
  body{background:radial-gradient(ellipse at 50% 38%,#3a1a3a 0%,#1B1424 35%,#07060B 75%);display:flex;align-items:center;justify-content:center}
  .c{text-align:center}
  img{width:460px;height:460px;border-radius:50%;box-shadow:0 0 140px rgba(244,196,90,.5);margin-bottom:70px}
  .t{font-family:Cinzel;font-weight:900;font-size:150px;line-height:1.05;background:linear-gradient(#FFF6CF,#F4C45A 55%,#A56A12);
    -webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 8px 10px rgba(0,0,0,.8))}
  .s{font-family:Oswald;font-weight:500;letter-spacing:8px;color:#7EE0FF;font-size:48px;margin-top:50px}
  </style></head><body><div class="c"><img src="${icon}"><div class="t">RELIC<br>VAULT</div>
  ${kind === 'end' ? '<div class="s">FREE TO PLAY</div>' : ''}</div></body></html>`;
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
for (const kind of ['title', 'end']) {
  const html = join(build, `${kind}.html`);
  writeFileSync(html, cardHtml(kind));
  await page.goto(pathToFileURL(html).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(build, `${kind}.png`) });
}
await browser.close();

// ---------- each shot a clip, then one concat
const fmtT = (x) => { const h = Math.floor(x / 3600), m = Math.floor((x % 3600) / 60), s = x % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`; };
const vtt = ['WEBVTT', ''];
const list = [];
let t0 = 0;
shots.forEach((shot, i) => {
  const out = join(build, `${String(i).padStart(2, '0')}.mp4`);
  const args = ['-v', 'error', '-y'];
  let D;
  if (shot.card) {
    D = shot.seconds;
    args.push('-loop', '1', '-framerate', '30', '-i', join(build, `${shot.card}.png`));
  } else {
    const seg = segments.find((s) => s.id === shot.segment);
    const clip = seg?.clips?.[shot.clip ?? 0];
    if (!clip) throw new Error(`trailer.json: no clip ${shot.clip ?? 0} of footage segment ${shot.segment} in segments.json`);
    const raw = join(rawDir, `${clip[0]}.webm`);
    if (!existsSync(raw)) throw new Error(`no footage at ${raw}: record it first (apps/web/tools/record.mjs <url> ${rawDir})`);
    if (shot.to > dur(raw)) throw new Error(`${shot.segment}: ${shot.to}s is past the end of ${raw}`);
    D = shot.to - shot.from;
    args.push('-ss', String(shot.from), '-t', String(D), '-i', raw);
  }
  args.push('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo');
  const fade = `fade=t=in:st=0:d=0.2,fade=t=out:st=${(D - 0.25).toFixed(2)}:d=0.25`;
  args.push('-filter_complex', `[0:v]fps=30,scale=1080:1920,setsar=1,format=yuv420p,setpts=PTS-STARTPTS,trim=duration=${D},${fade}[v]`,
    '-map', '[v]', '-map', '1:a', '-t', D.toFixed(2), '-r', '30',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', out);
  run('ffmpeg', args);
  list.push(`file '${out.replace(/\\/g, '/')}'`);
  vtt.push(`${fmtT(t0 + 0.1)} --> ${fmtT(t0 + D - 0.1)}`, shot.caption, '');
  t0 += D;
});
writeFileSync(join(build, 'list.txt'), list.join('\n'));
const trailer = join(vdir, 'trailer.mp4');
run('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(build, 'list.txt'), '-c', 'copy', '-movflags', '+faststart', trailer]);
writeFileSync(join(vdir, 'trailer.vtt'), vtt.join('\n'));
const total = dur(trailer);
if (total < 25 || total > 32) throw new Error(`trailer.mp4 is ${total.toFixed(1)}s; Play and the shot list want 25 to 32`);
console.log(`trailer.mp4 ${total.toFixed(1)}s, trailer.vtt ${shots.length} cues`);

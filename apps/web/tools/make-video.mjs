// Builds projects/relic-vault/video/overview.mp4 from video/segments.json:
//  - narration: Windows SAPI (System.Speech) via PowerShell, one WAV per segment
//  - slates: HTML rendered by Playwright (installed Edge) at 1080x1920
//  - footage: trims of the Playwright capture in video/raw
//  - captions.vtt: sentence-level cues timed across each narration WAV
// Usage: node apps/web/tools/make-video.mjs
import { chromium } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '../../..');
const vdir = join(root, 'video');
const build = join(vdir, 'build');
rmSync(build, { recursive: true, force: true });
mkdirSync(build, { recursive: true });
const segs = JSON.parse(readFileSync(join(vdir, 'segments.json'), 'utf8'));

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`${cmd} failed: ${r.stderr?.slice(-2000)}`);
  return r.stdout;
};
const dur = (f) => parseFloat(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]));

// ---------- narration
function tts(text, out) {
  const esc = text.replace(/'/g, "''");
  const ps = `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.SelectVoice('Microsoft David Desktop'); $s.Rate = -1; $s.SetOutputToWaveFile('${out}'); $s.Speak('${esc}'); $s.Dispose()`;
  run('powershell', ['-NoProfile', '-Command', ps]);
}

// ---------- slates
const font = (p) => pathToFileURL(join(root, 'node_modules/@fontsource', p)).href;
function slateHtml(s) {
  const icon = pathToFileURL(join(root, 'public/icons/icon-512.png')).href;
  return `<!doctype html><html><head><style>
  @font-face{font-family:Cinzel;font-weight:900;src:url(${font('cinzel/files/cinzel-latin-900-normal.woff2')})}
  @font-face{font-family:Cinzel;font-weight:700;src:url(${font('cinzel/files/cinzel-latin-700-normal.woff2')})}
  @font-face{font-family:Oswald;font-weight:500;src:url(${font('oswald/files/oswald-latin-500-normal.woff2')})}
  html,body{margin:0;width:1080px;height:1920px;overflow:hidden}
  body{background:radial-gradient(ellipse at 50% 38%,#3a1a3a 0%,#1B1424 35%,#07060B 75%);display:flex;align-items:center;justify-content:center;font-family:Oswald}
  .frame{position:absolute;inset:44px;border:10px solid #F4C45A;border-radius:28px;box-shadow:0 0 0 4px #2a1402,inset 0 0 0 4px #2a1402,inset 0 0 120px rgba(0,0,0,.7)}
  .c{position:relative;width:860px;text-align:center}
  .k{font-family:Oswald;font-weight:500;letter-spacing:6px;color:#7EE0FF;font-size:40px;margin-bottom:40px}
  .t{font-family:Cinzel;font-weight:900;font-size:${s.hero ? 150 : 84}px;line-height:1.1;background:linear-gradient(#FFF6CF,#F4C45A 55%,#A56A12);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 8px 10px rgba(0,0,0,.8));margin-bottom:40px;word-break:break-word}
  .l{color:#e8dcf0;font-size:44px;line-height:1.5;min-height:1em}
  .q{font-family:Cinzel;font-weight:700;color:#FFE9A3;font-size:58px;line-height:1.35}
  img{width:420px;height:420px;border-radius:50%;box-shadow:0 0 120px rgba(244,196,90,.45);margin-bottom:60px}
  </style></head><body><div class="frame"></div><div class="c">
  ${s.hero ? `<img src="${icon}">` : ''}
  <div class="k">${s.kicker || ''}</div>
  ${s.title ? `<div class="t">${s.title}</div>` : ''}
  ${s.quote ? `<div class="q">“${s.quote}”</div>` : ''}
  ${(s.lines || []).map((l) => `<div class="l">${l || '&nbsp;'}</div>`).join('')}
  </div></body></html>`;
}

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
for (const s of segs) {
  if (!s.slate) continue;
  const html = join(build, `${s.id}.html`);
  writeFileSync(html, slateHtml(s.slate));
  await page.goto(pathToFileURL(html).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(build, `${s.id}.png`) });
}
await browser.close();

// ---------- segments
const vtt = ['WEBVTT', ''];
let t0 = 0;
const fmtT = (x) => { const h = Math.floor(x / 3600), m = Math.floor((x % 3600) / 60), s = x % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`; };
const list = [];
for (const s of segs) {
  const wav = join(build, `${s.id}.wav`);
  let aDur = 0;
  if (s.say) { tts(s.say, wav); aDur = dur(wav); }
  const lead = s.say ? 0.4 : 0;
  const clipTotal = (s.clips || []).reduce((a, [, a0, a1]) => a + (a1 - a0), 0);
  const D = Math.max(s.min || 0, clipTotal, s.say ? aDur + lead + 0.9 : 0, s.slate ? (s.say ? aDur + 1.6 : 3) : 0);
  const out = join(build, `${s.id}.mp4`);
  const args = ['-v', 'error', '-y'];
  let filter = '';
  let vin = 0;
  if (s.slate) {
    args.push('-loop', '1', '-framerate', '30', '-i', join(build, `${s.id}.png`));
    filter += `[0:v]scale=1080:1920,format=yuv420p,trim=duration=${D}[vc];`;
    vin = 1;
  } else {
    s.clips.forEach(([name, a0, a1]) => args.push('-ss', String(a0), '-t', String(a1 - a0), '-i', join(vdir, 'raw', `${name}.webm`)));
    s.clips.forEach((_, i) => { filter += `[${i}:v]fps=30,scale=1080:1920,setsar=1,format=yuv420p,setpts=PTS-STARTPTS[c${i}];`; });
    filter += s.clips.map((_, i) => `[c${i}]`).join('') + `concat=n=${s.clips.length}:v=1:a=0[cc];`;
    filter += `[cc]tpad=stop_mode=clone:stop_duration=${Math.max(0, D - clipTotal + 0.1).toFixed(2)}[vc];`;
    vin = s.clips.length;
  }
  filter += `[vc]fade=t=in:st=0:d=0.25,fade=t=out:st=${(D - 0.3).toFixed(2)}:d=0.3[v];`;
  if (s.say) {
    args.push('-i', wav);
    filter += `[${vin}:a]adelay=${Math.round(lead * 1000)}|${Math.round(lead * 1000)},aresample=48000,aformat=channel_layouts=stereo,apad[a]`;
  } else {
    args.push('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo');
    filter += `[${vin}:a]anull[a]`;
  }
  args.push('-filter_complex', filter, '-map', '[v]', '-map', '[a]', '-t', D.toFixed(2), '-r', '30',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', out);
  run('ffmpeg', args);
  list.push(`file '${out.replace(/\\/g, '/')}'`);
  // captions: split narration into sentences, time proportional to length
  if (s.say) {
    const parts = s.say.match(/[^.!?]+[.!?]+/g) || [s.say];
    const total = parts.reduce((a, p) => a + p.length, 0);
    let c = t0 + lead;
    for (const p of parts) {
      const d = (p.length / total) * aDur;
      vtt.push(`${fmtT(c)} --> ${fmtT(c + d)}`, p.trim(), '');
      c += d;
    }
  }
  console.log(`${s.id}: ${D.toFixed(1)}s`);
  t0 += D;
}
writeFileSync(join(build, 'list.txt'), list.join('\n'));
run('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(build, 'list.txt'), '-c', 'copy', '-movflags', '+faststart', join(vdir, 'overview.mp4')]);
writeFileSync(join(vdir, 'captions.vtt'), vtt.join('\n'));
console.log(`overview.mp4 ${t0.toFixed(1)}s`);

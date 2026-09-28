// AB#4730: device QA on Android. Builds the debug APK, boots an emulator (or uses an attached device), installs and
// launches Relic Vault, then drives the game inside its WebView over Chrome DevTools (the apps/web/tools/play.mjs
// actions, through a small DevTools client below) and saves real device screenshots (adb screencap) at fixed moments, with a summary.json beside them.
//
//   node scripts/android-qa.mjs                      build, boot the rvqa_pixel8_36 emulator (created if missing), run
//   node scripts/android-qa.mjs --device <serial>    use an attached phone or a running emulator instead
//   options: --avd <name>  --no-build  --out <dir> (default screenshots/android)  --window  --keep (leave it running)
//
// The debug build is the one with remote WebView debugging: capacitor.config.ts leaves webContentsDebuggingEnabled
// unset, so Capacitor turns it on for debug and off for release. A release build cannot be driven this way.
// What this cannot see: real ads and purchases (test ids, AB#4724/#4725), touch feel, heat, and a mid-range phone's
// speed (an emulator's timings are the host's). docs/DEVICE_QA.md is the checklist a person runs on a real phone.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const PKG = 'com.orchestrata.relicvault';
const ACTIVITY = `${PKG}/.MainActivity`;
const APK = resolve(ROOT, 'android/app/build/outputs/apk/debug/app-debug.apk');
const DEFAULT_AVD = 'rvqa_pixel8_36';
const SYSTEM_IMAGE = 'system-images;android-36;google_apis;x86_64';

/** `am start -W` output -> { totalTime, waitTime } in ms (null when absent). */
export function parseAmStart(text) {
  const num = (k) => { const m = new RegExp(`^${k}:\\s*(\\d+)`, 'm').exec(text); return m ? Number(m[1]) : null; };
  return { totalTime: num('TotalTime'), waitTime: num('WaitTime'), status: /Status:\s*(\w+)/.exec(text)?.[1] ?? null };
}

/** The WebView's DevTools socket for one process, from /proc/net/unix (the name is webview_devtools_remote_<pid>). */
export function devtoolsSocket(procNetUnix, pid) {
  const names = [...procNetUnix.matchAll(/@(webview_devtools_remote_\d+|chrome_devtools_remote)\s*$/gm)].map((m) => m[1]);
  return names.find((n) => n === `webview_devtools_remote_${pid}`) ?? null;
}

/** The first even console port from `from` that no device in `adb devices` output is using. */
export function freeEmulatorPort(devicesText, from = 5700) {
  const used = new Set([...devicesText.matchAll(/emulator-(\d+)/g)].map((m) => Number(m[1])));
  for (let p = from; p < 5800; p += 2) if (!used.has(p) && !used.has(p + 1)) return p;
  return null;
}

/** The Android SDK: ANDROID_HOME, ANDROID_SDK_ROOT, android/local.properties, then the Android Studio default. */
export function sdkRoot(env = process.env) {
  if (env.ANDROID_HOME) return env.ANDROID_HOME;
  if (env.ANDROID_SDK_ROOT) return env.ANDROID_SDK_ROOT;
  const lp = resolve(ROOT, 'android/local.properties');
  const m = existsSync(lp) && /^sdk\.dir=(.*)$/m.exec(readFileSync(lp, 'utf8'));
  if (m) return m[1].trim().replace(/\\:/g, ':').replace(/\\\\/g, '\\');
  if (env.LOCALAPPDATA) return join(env.LOCALAPPDATA, 'Android', 'Sdk');
  return join(env.HOME || '', 'Android', 'Sdk');
}

function parseArgs(argv) {
  const o = { build: true, out: 'screenshots/android', avd: DEFAULT_AVD, device: null, window: false, keep: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-build') o.build = false;
    else if (a === '--window') o.window = true;
    else if (a === '--keep') o.keep = true;
    else if (a === '--device') o.device = argv[++i];
    else if (a === '--avd') o.avd = argv[++i];
    else if (a === '--out') o.out = argv[++i];
    else throw new Error(`unknown option ${a}`);
  }
  return o;
}

async function main() {
  const opt = parseArgs(process.argv.slice(2));
  const SDK = sdkRoot();
  const exe = process.platform === 'win32' ? '.exe' : '';
  const ADB = join(SDK, 'platform-tools', 'adb' + exe);
  const EMULATOR = join(SDK, 'emulator', 'emulator' + exe);
  if (!existsSync(ADB)) fail(`no adb at ${ADB}: install the Android SDK platform-tools, or set ANDROID_HOME.`);
  const t0 = Date.now();
  const log = (s) => console.log(`[android-qa ${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const adbRaw = (args, input) => spawnSync(ADB, args, { encoding: 'utf8', input, maxBuffer: 64 << 20 });
  let serial = opt.device;
  const adb = (...args) => { const r = adbRaw(['-s', serial, ...args]); if (r.status !== 0) throw new Error(`adb ${args.join(' ')}: ${r.stderr || r.stdout}`); return r.stdout; };
  const sh = (cmd) => adb('shell', cmd).trim();

  // 1. the debug APK
  if (opt.build) {
    log('building the debug APK (npm run android:apk)');
    const r = spawnSync(process.execPath, [resolve(ROOT, 'scripts/android.mjs'), 'apk'], { cwd: ROOT, stdio: 'inherit' });
    if (r.status !== 0) fail('the debug build failed (above).');
  }
  if (!existsSync(APK)) fail(`no APK at ${APK}: run without --no-build.`);

  // 2. a device: the one named, or our own emulator on a free port (never another session's)
  let ours = false;
  if (serial) {
    if (adbRaw(['-s', serial, 'get-state']).stdout.trim() !== 'device') fail(`${serial} is not attached (adb devices).`);
  } else {
    if (!existsSync(EMULATOR)) fail(`no emulator at ${EMULATOR}: install the SDK emulator, or pass --device.`);
    const avds = spawnSync(EMULATOR, ['-list-avds'], { encoding: 'utf8' }).stdout.split(/\r?\n/).map((s) => s.trim());
    if (!avds.includes(opt.avd)) {
      log(`creating AVD ${opt.avd} (Pixel 8, ${SYSTEM_IMAGE})`);
      const avdmanager = join(SDK, 'cmdline-tools', 'latest', 'bin', process.platform === 'win32' ? 'avdmanager.bat' : 'avdmanager');
      const r = spawnSync(avdmanager, ['create', 'avd', '-n', opt.avd, '-k', SYSTEM_IMAGE, '-d', 'pixel_8'], { input: 'no\n', encoding: 'utf8', shell: process.platform === 'win32' });
      if (r.status !== 0) fail(`avdmanager could not create ${opt.avd} (is ${SYSTEM_IMAGE} installed? sdkmanager "${SYSTEM_IMAGE}"): ${r.stderr || r.stdout}`);
    }
    const port = freeEmulatorPort(adbRaw(['devices']).stdout);
    if (!port) fail('no free emulator port between 5700 and 5800.');
    serial = `emulator-${port}`;
    const logFile = join(tmpdir(), `android-qa-emulator-${port}.log`);
    const fd = openSync(logFile, 'w');
    // -gpu host and 3 GB: with the AVD's default software GPU and 2 GB the emulator segfaulted loading the game (twice)
    const args = ['-avd', opt.avd, '-port', String(port), '-no-snapshot', '-no-boot-anim', '-no-audio', '-gpu', 'host', '-memory', '3072', '-cores', '4', ...(opt.window ? [] : ['-no-window'])];
    log(`booting ${opt.avd} as ${serial} (log ${logFile})`);
    spawn(EMULATOR, args, { detached: true, stdio: ['ignore', fd, fd] }).unref();
    ours = true;
    const deadline = Date.now() + 300_000;
    while (Date.now() < deadline) {
      const r = adbRaw(['-s', serial, 'shell', 'getprop', 'sys.boot_completed']);
      if (r.status === 0 && r.stdout.trim() === '1') break;
      await sleep(2000);
    }
    if (Date.now() >= deadline) fail(`${serial} did not finish booting in 5 minutes (see ${logFile}).`);
    log(`${serial} booted; letting it settle`);
    await sleep(20_000); // a fresh boot is still starting services, and System UI ANRs if the game loads over it
    adbRaw(['-s', serial, 'shell', 'am', 'broadcast', '-a', 'android.intent.action.CLOSE_SYSTEM_DIALOGS']);
  }

  const out = resolve(ROOT, opt.out);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const shots = [];
  const screencap = async (name) => {
    const r = spawnSync(ADB, ['-s', serial, 'exec-out', 'screencap', '-p'], { maxBuffer: 64 << 20 });
    const file = `${String(shots.length + 1).padStart(2, '0')}-${name}.png`;
    if (r.status !== 0 || !r.stdout?.length) throw new Error(`screencap failed: ${r.stderr}`);
    writeFileSync(join(out, file), r.stdout);
    shots.push(file);
    log(`shot ${file}`);
  };

  const summary = {
    device: { serial, model: sh('getprop ro.product.model'), api: Number(sh('getprop ro.build.version.sdk')), emulator: ours },
    webview: (/versionName=(\S+)/.exec(sh('dumpsys package com.google.android.webview')) || [])[1] ?? 'unknown',
    timings: {}, checks: {}, errors: [], shots,
  };
  const size = /(\d+)x(\d+)/.exec(sh('wm size'));
  summary.device.screen = size ? `${size[1]}x${size[2]}` : 'unknown';
  log(`device ${summary.device.model}, API ${summary.device.api}, WebView ${summary.webview}, ${summary.device.screen}`);

  // 3. install, and start from a clean install so the age gate shows
  log('installing');
  adb('install', '-r', APK);
  sh(`pm clear ${PKG}`);
  sh('settings put system accelerometer_rotation 0');
  sh('settings put system user_rotation 0');

  let page = null;
  const fwdPort = 9400 + (Number(/\d+$/.exec(serial)?.[0] || 0) % 500);
  const connect = async (timeout = 30_000) => {
    const deadline = Date.now() + timeout;
    let pid = '', sock = null;
    while (Date.now() < deadline) {
      pid = adbRaw(['-s', serial, 'shell', 'pidof', PKG]).stdout.trim().split(/\s+/)[0];
      if (pid) sock = devtoolsSocket(adbRaw(['-s', serial, 'shell', 'cat', '/proc/net/unix']).stdout, pid);
      if (sock) break;
      await sleep(200);
    }
    if (!sock) throw new Error(`no WebView DevTools socket for ${PKG} (pid ${pid || 'none'}): is this a debug build?`);
    adb('forward', `tcp:${fwdPort}`, `localabstract:${sock}`);
    page?.close();
    page = await CdpPage.open(fwdPort, deadline);
    page.onError = (text) => summary.errors.push(text);
  };
  const vs = (fn, arg) => page.evaluate(fn, arg);
  const wait = (ms) => sleep(ms);
  const hudReady = (timeout) => page.waitFor(() => !!(window.__vault && window.__vault.hud), timeout);
  const startActivity = () => parseAmStart(sh(`am start -W -n ${ACTIVITY}`));

  // the play.mjs actions: game space -> CSS pixels in the WebView, then a real pointer through DevTools
  const toCss = (x, y) => vs(([x, y]) => {
    const r = document.querySelector('#game canvas').getBoundingClientRect(), g = window.__game;
    return { x: r.left + (x / g.scale.width) * r.width, y: r.top + (y / g.scale.height) * r.height };
  }, [x, y]);
  const settle = () => page.waitFor(() => { const c = window.__vault?.cameras.main; return !c || (Math.abs(c.zoom - 1) < 0.001 && Math.abs(c.scrollX) < 1 && Math.abs(c.scrollY) < 1); }, 5000).catch(() => {});
  const tap = async (x, y) => { await settle(); const p = await toCss(x, y); await page.click(p.x, p.y); };
  const drag = async (a, b) => {
    await settle();
    const p = await toCss(a.x, a.y), q = await toCss(b.x, b.y);
    await page.mouse('mouseMoved', p.x, p.y); await page.mouse('mousePressed', p.x, p.y);
    for (let i = 1; i <= 8; i++) { await page.mouse('mouseMoved', p.x + (q.x - p.x) * i / 8, p.y + (q.y - p.y) * i / 8); await wait(16); }
    await page.mouse('mouseReleased', q.x, q.y);
  };
  const forge = async () => { const f = await vs(() => ({ x: window.__vault.forgeBtn.x, y: window.__vault.forgeBtn.y })); await tap(f.x, f.y); await wait(500); };
  const cell = (i) => vs((i) => window.__vault.cellPos(i), i);
  const closeModal = () => vs(() => window.__vault.modal?.close());
  const step = async (name, fn) => {
    try { await fn(); summary.checks[name] = summary.checks[name] ?? 'ran'; }
    catch (e) { summary.checks[name] = `FAILED: ${e.message.split('\n')[0]}`; log(`${name} failed: ${e.message.split('\n')[0]}`); }
  };

  try {
    // 4. first launch: the age gate
    const tLaunch = Date.now();
    summary.timings.firstLaunchAm = startActivity();
    await connect();
    await wait(600);
    await screencap('launch');
    await step('age gate', async () => {
      const gate = () => { const b = document.querySelector('#age-gate button[data-a="adult"]'); const r = b && b.getBoundingClientRect(); return r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; };
      await page.waitFor(gate, 60_000); // a first launch after install is slow: the WebView compiles the bundle
      summary.timings.firstLaunchToAgeGateMs = Date.now() - tLaunch;
      summary.timings.firstLaunchPageMsToAgeGate = await vs(() => Math.round(performance.now())); // from navigation start
      // the gate is in the DOM before the WebView has painted it: wait for two frames, then let a slow device catch up
      await vs(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); await wait(1500);
      await screencap('age-gate');
      const g = await vs(gate); await page.click(g.x, g.y);
      await hudReady(60_000);
      await wait(1500);
      await screencap('vault');
    });

    // 5. play: forge, merge, the shop, settings
    await step('forge', async () => {
      const before = await vs(() => window.__rv.state.board.filter(Boolean).length);
      for (let i = 0; i < 3; i++) await forge();
      const after = await vs(() => window.__rv.state.board.filter(Boolean).length);
      if (after <= before) throw new Error(`three forges left ${after} relics (was ${before})`);
      await screencap('forge');
    });
    await step('merge', async () => {
      await vs(() => { const s = window.__rv.state; s.board[20] = 3; s.board[21] = 3; window.__vault.syncBoard(); });
      await wait(400);
      await drag(await cell(21), await cell(20));
      await wait(900);
      const [a, b] = await vs(() => [window.__rv.state.board[20], window.__rv.state.board[21]]);
      if (a + b !== 4 || a * b !== 0) throw new Error(`dragging tier 3 onto tier 3 left cells 20,21 = ${a},${b}`);
      await screencap('merge');
      await closeModal(); await wait(400); // a first tier-4 opens its discovery card
    });
    await step('shop', async () => {
      await vs(() => window.__vault.openShop('qa')); await wait(1000);
      await screencap('shop');
    });
    await step('back button', async () => {
      // AB#4728: Back closes the open sheet rather than leaving the app. Recorded, not required, until that merges.
      sh('input keyevent KEYCODE_BACK'); await wait(1000);
      const alive = !!adbRaw(['-s', serial, 'shell', 'pidof', PKG]).stdout.trim();
      const front = /topResumedActivity=ActivityRecord\{\S+ \S+ (\S+)/.exec(sh('dumpsys activity activities'))?.[1];
      const sheetOpen = alive ? await vs(() => !!window.__vault.modal).catch(() => null) : null;
      summary.checks['back button'] = `app ${alive ? 'alive' : 'gone'}, top ${front || 'unknown'}, sheet ${sheetOpen === null ? 'unknown' : sheetOpen ? 'still open' : 'closed'}`;
      await screencap('after-back');
      if (!alive || !String(front).includes(PKG)) { startActivity(); await connect(); await hudReady(60_000); }
      await closeModal();
    });
    await step('settings', async () => {
      await vs(() => window.__vault.openSettings()); await wait(900);
      await screencap('settings');
      await closeModal(); await wait(400);
    });

    // 6. frame rate with a full board (36 relics) and particles: frames counted in the page for 3 s
    await step('fps', async () => {
      await vs(() => window.__vault.debugFill()); await wait(500);
      await vs(() => { const s = window.__rv.state; s.board[0] = 6; s.board[1] = 6; window.__vault.syncBoard(); });
      const fps = await vs(() => new Promise((res) => {
        let n = 0; const start = performance.now();
        const f = (t) => { n++; if (t - start < 3000) requestAnimationFrame(f); else res(Math.round((n * 1000) / (t - start))); };
        requestAnimationFrame(f);
      }));
      summary.timings.fullBoardFps = fps;
      await screencap('full-board');
    });

    // 7. rotation: the app is portrait-locked or it lays out again; either way it must not restart or lose the board
    await step('rotation', async () => {
      const before = await vs(() => ({ origin: performance.timeOrigin, gold: window.__rv.state.gold }));
      sh('settings put system user_rotation 1'); await wait(2000);
      await screencap('rotated');
      sh('settings put system user_rotation 0'); await wait(1500);
      const after = await vs(() => ({ origin: performance.timeOrigin, gold: window.__rv.state.gold })).catch(() => null);
      summary.checks.rotation = after && after.origin === before.origin ? 'page kept (no reload)' : 'PAGE RELOADED or lost';
    });

    // 8. background and resume: Home, wait, back in; the same page and the same state
    await step('background/resume', async () => {
      const before = await vs(() => ({ origin: performance.timeOrigin, board: window.__rv.state.board.join(',') }));
      sh('input keyevent KEYCODE_HOME'); await wait(3000);
      summary.timings.resumeAm = startActivity(); await wait(1200);
      const after = await vs(() => ({ origin: performance.timeOrigin, board: window.__rv.state.board.join(',') })).catch(() => null);
      summary.checks['background/resume'] = !after ? 'PAGE GONE' : after.origin !== before.origin ? 'page reloaded' : after.board === before.board ? 'resumed, board kept' : 'BOARD CHANGED';
      await screencap('resumed');
    });

    // 9. start-up time: cold (process killed) to the game being interactive, and warm (process alive, activity recreated)
    await step('cold start', async () => {
      sh(`am force-stop ${PKG}`); await wait(1000);
      const t = Date.now();
      summary.timings.coldAm = startActivity();
      await connect();
      await hudReady(60_000);
      summary.timings.coldToInteractiveMs = Date.now() - t; // an upper bound: it includes finding the socket and connecting
      summary.timings.coldPageMsToInteractive = await vs(() => Math.round(performance.now())); // the page's own clock, from navigation start
      await wait(800);
      await screencap('cold-start');
    });
    await step('warm start', async () => {
      sh('input keyevent KEYCODE_BACK'); sh('input keyevent KEYCODE_BACK'); await wait(1500);
      summary.timings.warmAm = startActivity();
    });
  } finally {
    page?.close();
    adbRaw(['-s', serial, 'forward', '--remove', `tcp:${fwdPort}`]);
    if (ours && !opt.keep) { log(`stopping ${serial}`); adbRaw(['-s', serial, 'emu', 'kill']); }
    summary.shots = readdirSync(out).filter((f) => f.endsWith('.png'));
    writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
    log(`summary ${join(out, 'summary.json')}`);
    console.log(JSON.stringify({ timings: summary.timings, checks: summary.checks, errors: summary.errors.length }, null, 2));
    if (Object.values(summary.checks).some((c) => /^FAILED/.test(c))) process.exitCode = 1;
  }
}

/**
 * Chrome DevTools, spoken directly to the WebView's page. Playwright's connectOverCDP cannot attach to an Android
 * WebView ("Browser context management is not supported"), and the page target is all this needs: evaluate, wait and
 * a real pointer (Input.dispatchMouseEvent, which the game receives as pointer events).
 */
class CdpPage {
  static async open(port, deadline) {
    let target = null;
    while (!target && Date.now() < deadline) {
      target = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json()).then((l) => l.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)).catch(() => null);
      if (!target) await new Promise((r) => setTimeout(r, 150));
    }
    if (!target) throw new Error('the WebView has no page to drive');
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('could not open the DevTools socket')); });
    const page = new CdpPage(ws);
    await page.send('Runtime.enable');
    return page;
  }
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.onError = () => {};
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.id && this.pending.has(d.id)) {
        const { res, rej } = this.pending.get(d.id); this.pending.delete(d.id);
        d.error ? rej(new Error(d.error.message)) : res(d.result);
      } else if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') {
        this.onError(d.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
      } else if (d.method === 'Runtime.exceptionThrown') {
        this.onError('PAGEERROR ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
      }
    };
    ws.onclose = () => { for (const { rej } of this.pending.values()) rej(new Error('the DevTools connection closed')); this.pending.clear(); };
  }
  send(method, params = {}) {
    const id = ++this.id;
    if (this.ws.readyState !== WebSocket.OPEN) return Promise.reject(new Error('the DevTools connection is closed'));
    return new Promise((res, rej) => { this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
  /** Runs `fn(arg)` in the page and returns its (awaited, JSON) value. */
  async evaluate(fn, arg) {
    const expression = `(${fn})(${arg === undefined ? '' : JSON.stringify(arg)})`;
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  }
  async waitFor(fn, timeout) {
    const deadline = Date.now() + timeout;
    for (;;) {
      const v = await this.evaluate(fn).catch(() => null);
      if (v) return v;
      if (Date.now() > deadline) throw new Error(`timed out after ${timeout} ms waiting for ${String(fn).slice(0, 80)}`);
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  mouse(type, x, y) {
    if (type !== 'mouseMoved') this.down = type === 'mousePressed';
    const held = type === 'mouseMoved' && this.down; // a move while pressed is a drag: the left button stays held
    return this.send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' && !held ? 'none' : 'left', buttons: this.down ? 1 : 0, clickCount: type === 'mouseMoved' ? 0 : 1 });
  }
  async click(x, y) { await this.mouse('mouseMoved', x, y); await this.mouse('mousePressed', x, y); await this.mouse('mouseReleased', x, y); }
  close() { try { this.ws.close(); } catch { /* already closed */ } }
}

function fail(msg) { console.error(`android-qa: ${msg}`); process.exit(1); }

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((e) => fail(e.stack || e.message));
}

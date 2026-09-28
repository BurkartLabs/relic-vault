import '@fontsource/cinzel/700.css';
import '@fontsource/cinzel/900.css';
import '@fontsource/oswald/500.css';
import '@fontsource/oswald/700.css';
import './style.css';
import Phaser from 'phaser';
import { ctx } from './game/GameCtx';
import { BootScene } from './game/scenes/BootScene';
import { BootLoadScene } from './game/scenes/BootLoadScene';
import { VaultScene } from './game/scenes/VaultScene';
import { mountDebug } from './debug';
import type { AgeBand } from './game/systems/State';
import { measureSafe, watchSafeArea } from './safeArea';
import { wireNativeApp } from './nativeApp';

// ---- install prompt (PWA)
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  (window as any).__installPrompt = e;
  ctx.telemetry.track('install_available');
});
window.addEventListener('appinstalled', () => ctx.telemetry.track('install_accepted'));

// ---- age gate (DOM is allowed here per spec: legal surface)
function ageGate(): Promise<AgeBand> {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.id = 'age-gate';
    el.innerHTML = `
      <div class="ag-card">
        <div class="ag-seal"></div>
        <h1>Before the vault opens</h1>
        <p>Relic Vault has optional purchases and chests with random contents (odds are always shown).</p>
        <p class="ag-q">How old are you?</p>
        <button data-a="adult">16 or older</button>
        <button data-a="minor" class="ag-sec">Under 16</button>
        <p class="ag-fine">Under 16: random paid chests are switched off and only exact-item offers are shown.</p>
      </div>`;
    document.body.appendChild(el);
    el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      const a = (b as HTMLButtonElement).dataset.a as AgeBand;
      el.classList.add('ag-out');
      setTimeout(() => el.remove(), 300);
      resolve(a);
    }));
  });
}

async function start() {
  performance.mark('rv:start'); // AB#4737: the boot's own timings, as performance measures named rv:*
  // safe areas (notches, system bars): env(), and in the Android app Capacitor's insets too (safeArea.ts, AB#4723)
  measureSafe();
  watchSafeArea();
  wireNativeApp(); // AB#4728: Android back button and lifecycle; nothing on the web
  const fonts = Promise.all([
    document.fonts.load('900 40px Cinzel'), document.fonts.load('700 40px Cinzel'),
    document.fonts.load('700 40px Oswald'), document.fonts.load('500 40px Oswald'),
  ]).catch(() => undefined);
  const booted = ctx.boot();
  (window as any).__ready = (async () => {
    await fonts;
    await booted;
    if (ctx.state.age === 'unknown') {
      ctx.telemetry.track('funnel_step', { step: 'age_gate_shown' });
      ctx.state.age = await ageGate();
      ctx.telemetry.track('funnel_step', { step: 'age_gate_done', band: ctx.state.age });
      ctx.persistNow();
    }
  })();
  await fonts; // text in the splash needs the display font
  performance.measure('rv:fonts', 'rv:start');
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: 'game',
    backgroundColor: '#07060B',
    scale: { mode: Phaser.Scale.EXPAND, autoCenter: Phaser.Scale.CENTER_BOTH, width: 1080, height: 1920 },
    render: { antialias: true, powerPreference: 'high-performance', roundPixels: false },
    input: { activePointers: 2 },
    fps: { target: 60 },
    scene: [BootScene, BootLoadScene, VaultScene],
  });
  (window as any).__game = game;
  const unlock = () => ctx.sfx.unlock();
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  if (new URLSearchParams(location.search).has('debug')) mountDebug();
}

start();

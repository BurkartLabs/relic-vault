/**
 * AB#4728: the Android app's back button and lifecycle (Capacitor's App plugin). Nothing here runs on the web.
 *
 * Back: game/systems/backButton.ts decides from what is topmost; this carries it out through each surface's own
 * control: a sheet's close(), the ad veil's skip, the Keeper's toast, and App.exitApp().
 * Background: the relic being dragged goes home, the save is written, telemetry records a pause (Telemetry.pause is
 * the same call a hidden tab makes, and a second call is ignored), and the game loop sleeps and the audio is suspended
 * (systems/Power.ts, AB#4712). Foreground: those come back, telemetry resumes and ctx.onResume runs.
 * The WebView is never reloaded: the page stays as the player left it.
 */
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { ctx } from './game/GameCtx';
import { AdVeil } from './game/ui/AdVeil';
import type { VaultScene } from './game/scenes/VaultScene';
import { createBackHandler, EXIT_WARNING, EXIT_WINDOW_MS } from './game/systems/backButton';
import { appBackgrounded, appForegrounded } from './game/systems/Power';

export function wireNativeApp() {
  if (!Capacitor.isNativePlatform()) return;
  const scene = () => (window as any).__vault as VaultScene | undefined;
  const onBack = createBackHandler({
    now: () => Date.now(),
    view: () => ({
      ageGate: !!document.getElementById('age-gate'),
      ready: !!scene(),
      adVeil: AdVeil.current?.backState ?? null,
      sheet: !!scene()?.modal,
    }),
    closeSheet: () => { const m = scene()?.modal; if (m) (m.onBack ?? (() => m.close()))(); },
    skipAd: () => { AdVeil.current?.back(); },
    warn: () => scene()?.toast(EXIT_WARNING, EXIT_WINDOW_MS),
    exit: () => { ctx.persistNow(); void App.exitApp(); },
  });
  // the last few presses and what each did, beside the other debug handles (__rv, __vault), so a device check can read
  // when a press arrived rather than guess it from outside
  const log: { at: number; action: string }[] = ((window as any).__rvBackLog = []);
  void App.addListener('backButton', () => { log.push({ at: performance.now(), action: onBack() }); if (log.length > 20) log.shift(); });
  void App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) {
      scene()?.cancelDrag();
      ctx.persistNow();
      ctx.telemetry.pause();
      appBackgrounded(); // AB#4712: no frames and no sound while the screen is off or the app is minimised
      return;
    }
    appForegrounded();
    ctx.telemetry.resume();
    for (const hook of ctx.onResume) {
      try { hook(); } catch (e) { ctx.error(String(e)); }
    }
  });
}

// The Android shell (AB#4723): Capacitor wraps the same web build the PWA serves (dist/, from `npm run build`).
// Nothing here changes the web build; docs/ANDROID.md explains the native side.
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.orchestrata.relicvault',
  appName: 'Relic Vault',
  webDir: 'dist',
  android: {
    // No http:// from an https:// page, and no remote WebView debugging in a release build.
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SystemBars: {
      // Capacitor's recommended handling (docs/ANDROID.md, "Edge to edge"): on WebView 140+ the page runs edge to edge
      // and env(safe-area-inset-*) is right; on older ones the WebView is padded inside the bars. Either way it also
      // sets --safe-area-inset-* on <html>, which measureSafe() reads alongside env().
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover', // apps/web/index.html's viewport meta is viewport-fit=cover
      style: 'DARK', // light icons on the vault's #07060B
    },
  },
};

export default config;

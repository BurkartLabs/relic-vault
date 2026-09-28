import { defineConfig } from '@playwright/test';
import { PLAYWRIGHT_WORKERS } from './scripts/test-workers.mjs';

// QA smoke (Orchestrata GOVERNANCE: QA may fail a preview). Uses the locally installed Edge
// (PW_CHANNEL=chrome to switch) so no browser download is needed.
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  retries: 0,
  workers: PLAYWRIGHT_WORKERS, // AB#4768: 1 unless TEST_PLAYWRIGHT_WORKERS says otherwise
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4174',
    channel: process.env.PW_CHANNEL || 'msedge',
    viewport: { width: 412, height: 892 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    screenshot: 'only-on-failure',
  },
  // QA builds into dist-qa pointed at a local collector so the smoke suite can prove events arrive
  // at a real sink (TELEMETRY.md). The shippable `dist/` from `npm run build` has no endpoint baked in.
  webServer: [
    {
      command: 'node apps/web/tools/collector.mjs 8788 test-results/telemetry',
      url: 'http://127.0.0.1:8788/health',
      reuseExistingServer: false,
      timeout: 20_000,
    },
    {
      command: 'npx vite build --outDir dist-qa && npx vite preview --outDir dist-qa --port 4174 --strictPort --host 127.0.0.1',
      url: 'http://127.0.0.1:4174',
      env: { VITE_TELEMETRY_URL: 'http://127.0.0.1:8788/e' },
      reuseExistingServer: false,
      timeout: 240_000,
    },
  ],
});

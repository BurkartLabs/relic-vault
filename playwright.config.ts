import { defineConfig } from '@playwright/test';

// QA smoke (Orchestrata GOVERNANCE: QA may fail a preview). Uses the locally installed Edge
// (PW_CHANNEL=chrome to switch) so no browser download is needed.
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  retries: 0,
  workers: 1,
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
  webServer: {
    command: 'npx vite build && npx vite preview --port 4174 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});

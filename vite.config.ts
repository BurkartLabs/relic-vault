import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'node:path';
import { MAX_WORKERS } from './scripts/test-workers.mjs';
import { readFileSync } from 'node:fs';

export default defineConfig({
  root: resolve(import.meta.dirname, 'apps/web'),
  publicDir: resolve(import.meta.dirname, 'public'),
  base: './',
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
  },
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
  // AB#4732: package.json's version, however the build is started (npm_package_version is set only under npm run)
  define: { __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8')).version) },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'Relic Vault',
        short_name: 'Relic Vault',
        id: 'relic-vault',
        description: 'Fuse the cursed gold. Merge relics in a living treasure vault.',
        theme_color: '#07060B',
        background_color: '#07060B',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
  test: {
    root: resolve(import.meta.dirname),
    // AB#4768: two workers per run, so several agents' suites fit on one PC at once (scripts/test-workers.mjs).
    maxWorkers: MAX_WORKERS,
    include: ['apps/web/src/**/*.test.ts', 'scripts/**/*.test.mjs'], // AB#4732: scripts/version.mjs's own tests
  },
} as any);

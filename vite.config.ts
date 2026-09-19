import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'node:path';

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
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0') },
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
    include: ['apps/web/src/**/*.test.ts'],
  },
} as any);

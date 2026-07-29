import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export const runtimeCaching = [
  {
    urlPattern: /^https:\/\/api\.weather\.gov\//,
    handler: 'NetworkFirst',
    options: {
      cacheName: 'nws-weather',
      networkTimeoutSeconds: 5,
      expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 },
    },
  },
  {
    urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
    handler: 'CacheFirst',
    options: {
      cacheName: 'google-fonts',
      expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
      cacheableResponse: { statuses: [0, 200] },
    },
  },
];

// https://vite.dev/config/
export default defineConfig({
  // Served from https://keithah.github.io/guidebook/ (a GitHub Pages
  // project site, not a custom domain) — every asset URL needs this prefix.
  // Change to '/' if this ever moves to a custom domain or a keithah.github.io user site.
  base: '/guidebook/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        id: '.',
        name: 'The SF Cottage — Guidebook',
        short_name: 'SF Cottage',
        description: "Keith's guest guidebook for The SF Cottage — WiFi, codes, getting around, and everything else for your stay.",
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#EDF1EF',
        theme_color: '#14201D',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The app shell and packaged neighborhood map are precached. Only
        // weather and fonts use runtime caching; live map/transit requests do
        // not enter the service worker cache.
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,webp}'],
        runtimeCaching,
      },
    }),
  ],
});

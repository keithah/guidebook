import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

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
        // App shell + property data cache-first (spec: "all content ... cached
        // for offline use"). Live data (weather, transit, map tiles) is
        // network-first with a fallback so it degrades gracefully instead of
        // going blank offline.
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,webp}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
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
            urlPattern: /^https:\/\/api\.511\.org\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: '511-transit',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 5 },
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
        ],
      },
    }),
  ],
});

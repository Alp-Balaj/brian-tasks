import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Our own worker (src/sw.ts, E8): the same precache as generateSW gave, plus push.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'Brian Tasks',
        short_name: 'Brian',
        description: 'Personal task manager',
        theme_color: '#f9f8f6',
        background_color: '#f9f8f6',
        display: 'standalone',
        start_url: '/home',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        // Cache the app shell only. Data never goes through the service worker:
        // it lives in localStorage and syncs through /api, which src/sw.ts leaves alone.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  server: {
    // `npm run server` on :3000 answers the API in dev. Point API_PROXY at the
    // production URL to sign this browser in against the real server instead
    // (e.g. to seed it from a localhost tab that holds your data).
    proxy: {
      '/api': { target: process.env.API_PROXY ?? 'http://localhost:3000', changeOrigin: true },
    },
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        consultation: resolve(import.meta.dirname, 'consultation.html'),
        accueil: resolve(import.meta.dirname, 'accueil.html'),
        mobile: resolve(import.meta.dirname, 'mobile.html'),
      },
    },
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8787',
    },
  },
})

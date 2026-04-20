import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { regox } from '@regox/vite-plugin'
import regoxConfig from './regox.config'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    regox(regoxConfig),
  ],
  build: {
    outDir: 'frontend/dist',
  },
  base: process.env.REGOX_CDN_URL ?? '/',
  server: {
    port: regoxConfig.dev?.port ?? 5173,
    proxy: {
      '/api': `http://localhost:${regoxConfig.dev?.goPort ?? 8080}`,
      ...regoxConfig.dev?.proxy,
    },
  },
})

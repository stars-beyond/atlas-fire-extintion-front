import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// No `npm run dev`, /api vai para o backend local (ou para ATLAS_API). Em produção quem faz esse papel
// é o Worker do Cloudflare (worker/index.ts), ou a própria API quando VITE_API_URL está definida.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': { target: process.env.ATLAS_API || 'http://localhost:8787', changeOrigin: true } } },
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 2000 },
})

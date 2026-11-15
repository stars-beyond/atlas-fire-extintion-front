import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// No `npm run dev`, /api vai para o backend local (ou para ATLAS_API). Em produção o site chama a API
// direto pela URL de VITE_API_URL (.env.production).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': { target: process.env.ATLAS_API || 'http://localhost:8787', changeOrigin: true } } },
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 2000 },
})

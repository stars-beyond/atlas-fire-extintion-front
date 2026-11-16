/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// No `npm run dev`, /api vai para o backend local (ou para ATLAS_API). No build do Cloudflare (WORKERS_CI_BRANCH
// definida, qualquer branch: main, dev ou preview de PR) o site chama a API de produção, a única que existe.
// VITE_API_URL, se definida, vale mais. Fora do Cloudflare (build local) fica vazia e o app decide em tempo de
// execução (src/api/client.ts): localhost → proxy, fora → produção.
const API_PROD = 'https://api.atlas-stars-beyond.tech'
const apiUrl = process.env.VITE_API_URL ?? (process.env.WORKERS_CI_BRANCH ? API_PROD : '')

export default defineConfig({
  plugins: [react()],
  define: { 'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl) },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: process.env.ATLAS_API || 'http://localhost:8787', changeOrigin: true },
    },
  },
  // Testes de unidade (`npm test`): só funções puras, rodando no Node, sem navegador e sem rede.
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
  build: {
    outDir: 'dist', sourcemap: false,
    rolldownOptions: {
      output: {
        // As bibliotecas grandes ficam cada uma no seu arquivo, baixado só pela tela que a usa (ver os lazy() em
        // App.tsx, Stage.tsx e AnswerEntry.tsx) e guardado em cache entre deploys que não mexem nelas.
        // O Vite 8 empacota com o Rolldown: o `manualChunks` do Rollup ficou obsoleto e o lugar disto é
        // `codeSplitting.groups`. Um grupo leva também as dependências dos módulos dele que nenhum grupo de
        // prioridade maior pegou. Por isso o React tem prioridade sobre os outros: sem ela ele vai parar em
        // `charts` ou `markdown` (que dependem dele) e a página inicial volta a baixar os dois.
        // Com grupos, o Rolldown sempre gera também o `rolldown-runtime` (menos de 1 kB, o apoio de CommonJS que
        // todos os pedaços usam): a página inicial baixa `index`, `react` e ele.
        codeSplitting: {
          groups: [
            { name: 'react', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 2 },
            { name: 'three', test: /[\\/]node_modules[\\/]three[\\/]/, priority: 1 },
            { name: 'charts', test: /[\\/]node_modules[\\/]recharts[\\/]/, priority: 1 },
            { name: 'markdown', test: /[\\/]node_modules[\\/](katex|react-markdown|remark-[^\\/]+|rehype-[^\\/]+)[\\/]/, priority: 1 },
          ],
        },
      },
    },
  },
})

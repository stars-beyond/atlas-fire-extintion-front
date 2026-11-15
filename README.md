# Atlas de Extinção · front

Interface do Atlas de Extinção (NASA Space Apps 2026, *Flame in Freefall*). Só renderiza: todo cálculo (veredito,
ranking, previsões, limites de inflamabilidade, gráficos do construtor, CSV) é feito pela API Go do
[`atlas-fire-extintion-backend`](../atlas-fire-extintion-backend). Publicada no **Cloudflare Workers & Pages** como
site estático.

```
atlas-stars-beyond.tech / www  ─► Cloudflare (este projeto: só arquivos estáticos)
        │ o navegador chama a API direto (CORS)
        ▼
https://api.atlas-stars-beyond.tech ─► Cloudflare ─► nginx na VPS ─► API Go
```

## Rodar local

```bash
npm install
npm run dev              # http://localhost:5173, /api vai para http://localhost:8787 (proxy do Vite)
```

Outra API pelo proxy: `ATLAS_API=https://api.atlas-stars-beyond.tech npm run dev`.

## Deploy

A URL da API vem de [`.env.production`](.env.production) (`VITE_API_URL`) e entra no JavaScript no build. Trocar a
API é editar esse arquivo e publicar de novo.

```bash
npx wrangler login
npm run deploy           # vite build + wrangler deploy
```

Ou pelo painel (Workers & Pages → repositório conectado): build command `npm run build`, deploy command
`npx wrangler deploy`. Domínios: `atlas-stars-beyond.tech` e `www` como Custom domains do Worker.

## Limites a conhecer

- Perguntas com IA (`/api/ask`) podem demorar. O Cloudflare corta respostas que passam de 100 s (erro 524).
- O **Laboratório de chama 3D** (`public/lab3d/`) é um solver de combustão em WebGL2 que roda na placa de vídeo de
  quem abre a página. É a única simulação que continua no navegador: é visual, em tempo real, e os parâmetros
  físicos (materiais, gases, constantes) vêm da API em `/api/sim/config`. O veredito exibido é sempre o da API.

## Estrutura

```
src/
├─ main.tsx            entrada
├─ app/                App (troca de telas) e layout/ (Header, SpecBar)
├─ api/                client (API_BASE de VITE_API_URL ou /api), stream (SSE) e um módulo por domínio;
│                      index.ts junta tudo no objeto `api`
├─ types/              tipos das respostas da API, por domínio
├─ state/              AtlasProvider (contexto e useAtlas), materiais, estado do lab3d (useLab)
├─ features/
│  ├─ configurator/    Habitat, Material, Test drive (abas Evidência e Apagar) e Ficha técnica
│  ├─ stage/           palco: Stage orquestra cena do habitat, lab3d, mapa, grafo e limites
│  ├─ ask/             Perguntar, resposta em streaming, Markdown com fórmulas
│  ├─ findings/        Achados, Monte seu gráfico, Auditoria
│  ├─ investigations/  Investigações (ficha e comparação)
│  └─ next-fire/       Próximo fogo
├─ three/              cena 3D (three.js): engine, peças, modelos, mapa dos testes
├─ components/         peças usadas por mais de uma feature (Seal, Gaps)
├─ lib/                formatação pt-BR, download, detecção de GPU (modo leve)
└─ styles/             tokens, base e uma folha por área, importadas em index.css na ordem original
```

| Fora de `src/` | O que é |
|---|---|
| `public/lab3d/` | Laboratório de chama 3D (iframe); recebe a base da API por `?api=` |
| `public/models/`, `public/draco/` | Modelos 3D dos habitats e o decodificador Draco |
| `public/_headers` | Cache dos arquivos estáticos |
| `.env.production` | URL pública da API usada no build |
| `wrangler.jsonc` | Configuração do Cloudflare (só assets) |

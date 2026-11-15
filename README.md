# Atlas de Extinção · front

Interface do Atlas de Extinção (NASA Space Apps 2026, *Flame in Freefall*). Só renderiza: todo cálculo (veredito,
ranking, previsões, limites de inflamabilidade, gráficos do construtor, CSV) é feito pela API Go do repositório
[`atlas-fire-extintion`](../atlas-fire-extintion). Publicada no **Cloudflare Workers & Pages** como um Worker com
arquivos estáticos.

```
navegador ──► Cloudflare (este projeto)
               ├─ /*      arquivos do build do Vite (dist/), fallback de SPA
               └─ /api/*  worker/index.ts ──► API_ORIGIN (backend Go, porta 8787)
```

## Rodar local

```bash
npm install
npm run dev              # http://localhost:5173, /api vai para http://localhost:8787
```

Outra API: `ATLAS_API=https://api.seudominio.com npm run dev`.

Para testar o Worker igual à produção: `cp .dev.vars.example .dev.vars` e `npm run cf:dev` (http://localhost:8787 é
o backend; o wrangler sobe em outra porta, mostrada no terminal).

## Deploy no Cloudflare

### 1. Dar um nome ao backend

O Worker **não consegue chamar um IP direto** (o Cloudflare devolve o erro 1003). O backend precisa de um hostname.
Duas opções:

- **Cloudflare Tunnel (recomendado).** No servidor da API: `cloudflared tunnel` apontando `api.seudominio.com` para
  `http://localhost:8787`. Sai com HTTPS, sem abrir porta no firewall.
- **Registro DNS.** Crie `A api.seudominio.com → IP do servidor`.
  - *Proxied* (nuvem laranja): o Cloudflare só repassa algumas portas (80, 8080, 8880, 2052, 2082, 2086, 2095 em HTTP;
    443, 8443 e outras em HTTPS). A 8787 não está na lista: publique a API numa delas (ex.: `API_PORT=8080` no `.env`
    do backend) e use `http://api.seudominio.com:8080`.
  - *DNS only* (nuvem cinza): use `http://api.seudominio.com:8787`.

### 2. Configurar `API_ORIGIN`

No painel: **Workers & Pages → atlas-fire-extintion-front → Settings → Variables and Secrets → Add**, nome
`API_ORIGIN`, valor com a origem do backend sem `/api` no final (ex.: `https://api.seudominio.com`). Salve e faça
*Deploy*. O `wrangler.jsonc` tem `keep_vars: true`, então novos deploys não apagam esse valor.

Sem `API_ORIGIN`, o site abre mas toda chamada a `/api` responde 503 com a mensagem
"API_ORIGIN não configurada".

### 3. Publicar

Pela linha de comando:

```bash
npx wrangler login
npm run deploy
```

Ou pelo painel: **Workers & Pages → Create → Import a repository**, com build command `npm run build` e deploy
command `npx wrangler deploy`.

### Alternativa: navegador chamando a API direto

Com `VITE_API_URL=https://api.seudominio.com` no build (veja `.env.example`), o front chama a API sem passar pelo
Worker. A API já libera CORS. Precisa ser HTTPS: a página é HTTPS e o navegador bloqueia chamadas `http://`. Mudar o
endereço exige novo build.

## Limites a conhecer

- Perguntas com IA (`/api/ask`) podem demorar. Um hostname *proxied* pelo Cloudflare corta a resposta em 100 s
  (erro 524); o Tunnel ou o DNS only não têm esse corte.
- O **Laboratório de chama 3D** (`public/lab3d/`) é um solver de combustão em WebGL2 que roda na placa de vídeo de
  quem abre a página. É a única simulação que continua no navegador: é visual, em tempo real, e os parâmetros
  físicos (materiais, gases, constantes) vêm da API em `/api/sim/config`. O veredito exibido é sempre o da API.

## Estrutura

| Caminho | O que é |
|---|---|
| `src/api.ts` | Cliente da API e tipos. `API_BASE` vem de `VITE_API_URL` ou cai em `/api` |
| `src/` | React, three.js e recharts: só desenho e estado da tela |
| `public/lab3d/` | Laboratório de chama 3D (iframe); recebe a base da API por `?api=` |
| `public/models/`, `public/draco/` | Modelos 3D dos habitats e o decodificador Draco |
| `public/_headers` | Cache dos arquivos estáticos |
| `worker/index.ts` | Worker: proxy de `/api/*` para `API_ORIGIN` e entrega dos estáticos |
| `wrangler.jsonc` | Configuração do Cloudflare |

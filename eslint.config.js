// ESLint (configuração flat). Roda com `npm run lint`; a meta é zero erros (avisos ficam como avisos).
import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig(
  // public/lab3d é o JavaScript do laboratório 3D da equipe (outro projeto, copiado para cá) e public/draco é
  // binário/minificado: nenhum dos dois segue as regras deste código.
  globalIgnores(['dist/', 'node_modules/', 'public/', '.wrangler/']),

  js.configs.recommended,
  // Só as regras recomendadas que não precisam do type-checker: o `tsc --noEmit` já faz essa parte.
  tseslint.configs.recommended,

  {
    rules: {
      // Os `any` deste código são deliberados e ficam na fronteira com a API: `Insight.data` muda de forma a cada
      // achado, as linhas de /tests chegam como matriz, e os quadros do stream são JSON sem esquema. Quem os lê
      // confere a forma antes (Array.isArray, `?.`). O resto do código continua em TypeScript strict.
      '@typescript-eslint/no-explicit-any': 'off',
      // Caracteres de controle em expressão regular são o próprio assunto de safeHref (src/lib/url.ts) e do
      // cenário salvo (src/state/scenario.ts): os dois existem para barrá-los.
      'no-control-regex': 'off',
    },
  },

  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    // Só as regras do plugin, sem o `configs` dele: a declaração de tipos do `configs.flat` (v7.1) não bate com
    // o tipo Plugin do ESLint 10 e este arquivo é checado pelo tsc (tsconfig.node.json).
    plugins: { 'react-hooks': { meta: reactHooks.meta, rules: reactHooks.rules } },
    rules: {
      // Só as duas regras clássicas dos hooks. O conjunto `recommended` do plugin (v7) liga também as regras do
      // React Compiler (set-state-in-effect, refs, purity...), que este projeto não usa.
      'react-hooks/rules-of-hooks': 'error',
      // Aviso, não erro: acrescentar uma dependência a um efeito muda quando ele roda (pode virar um laço de
      // pedidos à API). Cada aviso é para ser lido, não "corrigido" no automático.
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // Arquivos de configuração: rodam no Node, não no navegador.
  { files: ['*.config.{js,ts}'], languageOptions: { globals: globals.node } },
)

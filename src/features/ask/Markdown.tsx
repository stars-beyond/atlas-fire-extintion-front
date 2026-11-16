// Resposta em Markdown com fórmulas em LaTeX e citações [n] clicáveis.
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import 'katex/dist/katex.min.css'

const MAX_RANGE = 30   // quantas citações uma faixa [a–b] pode ter

// Troca [n] por um link interno só fora de fórmulas e de código: ali o colchete é índice, não citação.
export function linkCitations(text: string) {
  return text.split(/(```[\s\S]*?```|`[^`\n]*`|\$\$[\s\S]*?\$\$|\$(?:\\.|[^$\\\n])+\$)/g)
    .map((part, i) => (i % 2 ? part : part
      // faixas como [6–8] viram [6][7][8]. Faixa invertida ([8–6]) ou grande demais para ser de citações
      // ([1990–2020]; [1–999999999] travaria a página ao ser expandida) não é citação: fica como veio.
      .replace(/\[(\d+)\s*[–-]\s*(\d+)\]/g, (m, a, b) => { const n = +b - +a + 1; return n >= 1 && n <= MAX_RANGE ? Array.from({ length: n }, (_x, k) => `[${+a + k}]`).join('') : m })
      .replace(/\[(\d+)\]/g, '[$1](#cite-$1)')))
    .join('')
}

export function Markdown({ text, onCite }: { text: string; onCite: (n: number) => void }) {
  return (
    <div className="md">
      {/* sem imagens: o texto vem de um modelo que leu documentos externos, e uma imagem remota faria o navegador
          buscar um endereço escolhido por esse texto */}
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} disallowedElements={['img']}
        components={{
          a({ href, children }) {
            const m = /^#cite-(\d+)$/.exec(href ?? '')
            if (m) return <button className="cite" onClick={() => onCite(+m[1])}>{m[1]}</button>
            return <a href={href} target="_blank" rel="noreferrer">{children}</a>
          },
        }}>
        {linkCitations(text)}
      </ReactMarkdown>
    </div>
  )
}

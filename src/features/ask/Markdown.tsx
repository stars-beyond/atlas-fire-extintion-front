// Resposta em Markdown com fórmulas em LaTeX e citações [n] clicáveis.
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import 'katex/dist/katex.min.css'

// Troca [n] por um link interno só fora de fórmulas e de código: ali o colchete é índice, não citação.
function linkCitations(text: string) {
  return text.split(/(```[\s\S]*?```|`[^`\n]*`|\$\$[\s\S]*?\$\$|\$(?:\\.|[^$\\\n])+\$)/g)
    .map((part, i) => (i % 2 ? part : part
      // faixas como [6–8] viram [6][7][8]
      .replace(/\[(\d+)\s*[–-]\s*(\d+)\]/g, (_, a, b) => Array.from({ length: Math.max(0, +b - +a + 1) }, (_x, k) => `[${+a + k}]`).join(''))
      .replace(/\[(\d+)\]/g, '[$1](#cite-$1)')))
    .join('')
}

export function Markdown({ text, onCite }: { text: string; onCite: (n: number) => void }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}
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

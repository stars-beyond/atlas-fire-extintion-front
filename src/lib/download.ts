// Baixa um arquivo a partir de uma URL (ou data: URL) com um link temporário.
export function download(name: string, href: string) { const a = document.createElement('a'); a.href = href; a.download = name; a.click() }

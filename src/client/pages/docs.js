function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

function mdToHtml(md) {
  let html = md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => `<pre><code>${escapeHtml(code)}</code></pre>`)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^---$/gm, '<hr>')
    .replace(/^\|(.+)\|$/gm, (line) => {
      if (line.includes('---|---|---')) return ''
      const cells = line.slice(1, -1).split('|').map(c => c.trim())
      return '<tr><td>' + cells.join('</td><td>') + '</td></tr>'
    })
    .replace(/(<tr>.*<\/tr>(\s|<br>)*){2,}/g, (table) => {
      const rows = table.trim().split(/\s*<br>\s*/).filter(Boolean)
      return '<table>' + rows.join('') + '</table>'
    })
    .replace(/^\- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>(\s)*)+/g, (list) => {
      return '<ul>' + list.trim().replace(/<br>/g, '') + '</ul>'
    })
    .replace(/^>\s?(.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')

  html = html.replace(/<br>\s*<br>/g, '</p><p>')
  return '<p>' + html + '</p>'
}

export function renderDocs() {
  const app = document.getElementById('app')
  app.innerHTML = `
    <div style="text-align:center;padding:60px 0">
      <h1>Documentación</h1>
      <p style="color:#666">Todavía no hay documentación. Consultá el <a href="/README.md">README</a> por ahora.</p>
    </div>
  `
}

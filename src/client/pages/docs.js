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

const docsTree = [
  { name: 'engine', label: 'Motor gráfico', children: [
    { path: 'engine/rendering', label: 'Renderizado' },
    { path: 'engine/camera', label: 'Cámara' },
    { path: 'engine/raycaster', label: 'Selección' },
    { path: 'engine/grid', label: 'Grid y ejes' },
  ]},
  { name: 'system', label: 'Sistemas', children: [
    { path: 'system/web', label: 'Frontend web' },
    { path: 'system/server', label: 'Servidor' },
  ]},
]

export function renderDocs(path) {
  const app = document.getElementById('app')

  const treeHtml = docsTree.map(group => `
    <details open>
      <summary>${group.label}</summary>
      ${group.children.map(c => `
        <a href="#" data-doc="${c.path}">${c.label}</a>
      `).join('')}
    </details>
  `).join('')

  app.innerHTML = `
    <h1>Documentación</h1>
    <div style="display:grid;grid-template-columns:240px 1fr;gap:24px">
      <div class="docs-tree">${treeHtml}</div>
      <div class="docs-content" id="docs-content">
        <p style="color:#666">Seleccioná un tema del árbol para ver su documentación.</p>
      </div>
    </div>
  `

  app.querySelectorAll('[data-doc]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault()
      const docPath = a.dataset.doc
      history.replaceState(null, '', `#/docs/${docPath}`)
      loadDoc(docPath)
    })
  })

  if (path) loadDoc(path)
}

function loadDoc(path) {
  const container = document.getElementById('docs-content')
  container.innerHTML = '<p style="color:#666">Cargando...</p>'

  fetch(`/api/docs/${path}/README.md`)
    .then(r => {
      if (!r.ok) throw new Error('Not found')
      return r.text()
    })
    .then(md => container.innerHTML = mdToHtml(md))
    .catch(() => {
      container.innerHTML = mdToHtml(
        `# Documento no encontrado\n\nTodavía no hay documentación para esta sección.`
      )
    })
}

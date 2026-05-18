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

const labels = {
  engine: 'Motor gráfico',
  rendering: 'Renderizado',
  camera: 'Cámara',
  grid: 'Grid',
  raycaster: 'Raycaster',
  mecanics: 'Mecánicas',
  movement: 'Movimiento',
  combat: 'Combate',
  crafting: 'Crafting',
  inventory: 'Inventario',
  interaction: 'Interacción',
  npc: 'NPC',
  system: 'Sistema',
  web: 'Frontend web',
  server: 'Servidor',
  tools: 'Herramientas',
  'material-creator': 'Material Creator',
  'texture-painter': 'Texture Painter',
  'voxel-modeler': 'Voxel Modeler',
  studio: 'Studio',
}

function getLabel(name) {
  return labels[name] || name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ')
}

let currentPath = null
let treeData = []

export function renderDocs(path) {
  currentPath = path || null
  const app = document.getElementById('app')

  app.innerHTML = `
    <h1>Documentación</h1>
    <div id="docs-layout" style="display:grid;grid-template-columns:240px 1fr;gap:24px">
      <div class="docs-tree" id="docs-tree"><p style="color:#666">Cargando...</p></div>
      <div class="docs-content" id="docs-content">
        <p style="color:#666">Seleccioná un tema del árbol para ver su documentación.</p>
      </div>
    </div>
  `

  fetch('/api/docs/tree')
    .then(r => r.json())
    .then(tree => {
      treeData = tree
      renderTree()
      if (currentPath) loadDoc(currentPath)
    })
    .catch(() => {
      document.getElementById('docs-tree').innerHTML = '<p style="color:#666">Error al cargar</p>'
    })
}

function renderTree() {
  const container = document.getElementById('docs-tree')
  container.innerHTML = renderNodes(treeData, 0)
  container.querySelectorAll('[data-doc-link]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault()
      const path = a.dataset.docLink
      currentPath = path
      history.replaceState(null, '', `#/docs/${path}`)
      loadDoc(path)
      highlightActive()
    })
  })
  highlightActive()
}

function renderNodes(nodes, depth) {
  return nodes.map(node => {
    const hasChildren = node.children && node.children.length > 0
    const label = getLabel(node.name)
    const padding = depth * 16 + 8

    if (hasChildren) {
      const childHtml = renderNodes(node.children, depth + 1)
      return `
        <details ${depth === 0 ? 'open' : ''}>
          <summary style="padding:4px 0 4px ${padding}px;cursor:pointer;color:#aaa;font-weight:600;font-size:13px">
            ${label}
          </summary>
          ${childHtml}
        </details>
      `
    }

    return `
      <a href="#" data-doc-link="${node.path}"
         style="display:block;padding:4px 0 4px ${padding}px;color:#888;font-size:13px;text-decoration:none">
        ${label}
      </a>
    `
  }).join('')
}

function highlightActive() {
  document.querySelectorAll('[data-doc-link]').forEach(a => {
    const isActive = a.dataset.docLink === currentPath
    a.style.color = isActive ? '#44aa88' : '#888'
    a.style.fontWeight = isActive ? '600' : '400'
  })
}

function loadDoc(path) {
  if (!path) return
  const container = document.getElementById('docs-content')
  if (!container) return
  container.innerHTML = '<p style="color:#666">Cargando...</p>'

  fetch(`/api/docs/${path}/README.md`)
    .then(r => {
      if (!r.ok) throw new Error('Not found')
      return r.text()
    })
    .then(md => {
      currentPath = path
      const crumbs = path.split('/').map((part, i, arr) => {
        const p = arr.slice(0, i + 1).join('/')
        const isLast = i === arr.length - 1
        const label = getLabel(part)
        if (isLast) return `<span style="color:#44aa88">${label}</span>`
        return `<a href="#" data-crumb="${p}" style="color:#888;text-decoration:none">${label}</a>`
      }).join(' <span style="color:#555">/</span> ')

      container.innerHTML = `
        <div style="font-size:13px;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid #333">${crumbs}</div>
        ${mdToHtml(md)}
      `

      container.querySelectorAll('[data-crumb]').forEach(a => {
        a.addEventListener('click', e => {
          e.preventDefault()
          const p = a.dataset.crumb
          currentPath = p
          history.replaceState(null, '', `#/docs/${p}`)
          loadDoc(p)
          highlightActive()
        })
      })

      highlightActive()
    })
    .catch(() => {
      container.innerHTML = mdToHtml(
        `# Documento no encontrado\n\nTodavía no hay documentación para esta sección.`
      )
    })
}

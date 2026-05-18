import { initPreview } from '../components/material-preview.js'

let preview = null
let currentId = null

export function renderMaterialCreator() {
  const app = document.getElementById('app')
  app.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h1 style="margin:0">Material Creator</h1>
      <button id="mc-new" class="btn-primary">+ Nuevo</button>
    </div>
    <div id="mc-layout" style="display:grid;grid-template-columns:200px 1fr 280px;gap:16px;height:calc(100vh - 180px)">
      <div id="mc-list" style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:8px;overflow-y:auto"></div>
      <div id="mc-preview" style="background:#1a1a1a;border:1px solid #333;border-radius:8px;overflow:hidden"></div>
      <div id="mc-props" style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:16px;overflow-y:auto"></div>
    </div>
  `

  document.getElementById('mc-new').addEventListener('click', () => newMaterial())

  renderProps(null)
  loadList()
  initPreviewContainer()
}

function initPreviewContainer() {
  const container = document.getElementById('mc-preview')
  preview = initPreview(container)
}

function loadList() {
  fetch('/api/resources/materials')
    .then(r => r.json())
    .then(list => renderList(list))
    .catch(() => renderList([]))
}

function renderList(list) {
  const el = document.getElementById('mc-list')
  el.innerHTML = list.length === 0
    ? '<p style="color:#666;font-size:13px;padding:8px">Sin materiales aún.</p>'
    : list.map(m => `
      <div class="mc-list-item" data-id="${m.id}" style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:6px;cursor:pointer;transition:background 0.15s"
           onmouseenter="this.style.background='#2a2a2a'" onmouseleave="this.style.background='transparent'">
        <span data-id="${m.id}" style="flex:1">${escapeHtml(m.name)}</span>
        <button class="btn-delete" data-id="${m.id}" style="background:none;border:none;color:#cc4444;cursor:pointer;font-size:14px;padding:0 4px"
                title="Eliminar">×</button>
      </div>
    `).join('')

  el.querySelectorAll('.mc-list-item').forEach(item => {
    item.addEventListener('click', e => {
      if (e.target.tagName === 'BUTTON') return
      const id = item.dataset.id
      loadMaterial(id)
    })
  })

  el.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      const id = btn.dataset.id
      if (confirm('¿Eliminar este material?')) {
        deleteMaterial(id)
      }
    })
  })
}

function loadMaterial(id) {
  fetch(`/api/resources/materials/${id}`)
    .then(r => r.json())
    .then(m => {
      currentId = m.id
      renderProps(m)
      preview.updateMaterial(m)
    })
    .catch(() => {})
}

function newMaterial() {
  currentId = null
  const empty = { color: '#888888', roughness: 0.5, metalness: 0.1 }
  renderProps(empty)
  preview.updateMaterial(empty)
}

function renderProps(m) {
  const el = document.getElementById('mc-props')
  if (!m) {
    el.innerHTML = '<p style="color:#666;font-size:13px">Seleccioná o creá un material para editar.</p>'
    return
  }
  el.innerHTML = `
    <label style="display:block;font-size:12px;color:#888;margin-bottom:4px">Nombre</label>
    <input id="mc-name" type="text" value="${escapeHtml(m.name || '')}" style="width:100%;margin-bottom:12px;background:#222;color:#ddd;border:1px solid #444;border-radius:6px;padding:6px 10px;font-size:13px">

    <label style="display:block;font-size:12px;color:#888;margin-bottom:4px">Color</label>
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px">
      <input id="mc-color" type="color" value="${m.color || '#888888'}" style="width:40px;height:32px;border:none;border-radius:4px;cursor:pointer;background:none;padding:0">
      <span id="mc-color-label" style="font-size:12px;color:#888">${m.color || '#888888'}</span>
    </div>

    <label style="display:block;font-size:12px;color:#888;margin-bottom:4px">Roughness <span id="mc-roughness-label">${m.roughness != null ? m.roughness.toFixed(2) : '0.50'}</span></label>
    <input id="mc-roughness" type="range" min="0" max="1" step="0.01" value="${m.roughness != null ? m.roughness : 0.5}" style="width:100%;margin-bottom:12px;accent-color:#44aa88">

    <label style="display:block;font-size:12px;color:#888;margin-bottom:4px">Metalness <span id="mc-metalness-label">${m.metalness != null ? m.metalness.toFixed(2) : '0.10'}</span></label>
    <input id="mc-metalness" type="range" min="0" max="1" step="0.01" value="${m.metalness != null ? m.metalness : 0.1}" style="width:100%;margin-bottom:20px;accent-color:#44aa88">

    <div style="display:flex;gap:8px">
      <button id="mc-save" class="btn-primary" style="flex:1">Guardar</button>
      <button id="mc-delete" class="btn-danger" ${!currentId ? 'disabled style="opacity:0.4"' : ''}>Eliminar</button>
    </div>
  `

  el.querySelector('#mc-name').addEventListener('input', updatePreview)
  el.querySelector('#mc-color').addEventListener('input', updatePreview)
  el.querySelector('#mc-roughness').addEventListener('input', updatePreview)
  el.querySelector('#mc-metalness').addEventListener('input', updatePreview)
  el.querySelector('#mc-save').addEventListener('click', saveMaterial)

  const delBtn = el.querySelector('#mc-delete')
  if (currentId) {
    delBtn.addEventListener('click', () => {
      if (confirm('¿Eliminar este material?')) deleteMaterial(currentId)
    })
  }
}

function updatePreview() {
  const name = document.getElementById('mc-name')?.value || ''
  const color = document.getElementById('mc-color')?.value || '#888888'
  const roughness = parseFloat(document.getElementById('mc-roughness')?.value || 0.5)
  const metalness = parseFloat(document.getElementById('mc-metalness')?.value || 0.1)

  document.getElementById('mc-color-label').textContent = color
  document.getElementById('mc-roughness-label').textContent = roughness.toFixed(2)
  document.getElementById('mc-metalness-label').textContent = metalness.toFixed(2)

  if (preview) {
    preview.updateMaterial({ color, roughness, metalness })
  }
}

function saveMaterial() {
  const name = document.getElementById('mc-name')?.value
  const color = document.getElementById('mc-color')?.value || '#888888'
  const roughness = parseFloat(document.getElementById('mc-roughness')?.value || 0.5)
  const metalness = parseFloat(document.getElementById('mc-metalness')?.value || 0.1)

  if (!name || !name.trim()) {
    alert('El nombre es obligatorio')
    return
  }

  const data = { name: name.trim(), color, roughness, metalness }

  const method = currentId ? 'PUT' : 'POST'
  const url = currentId
    ? `/api/resources/materials/${currentId}`
    : '/api/resources/materials'

  fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
    .then(r => r.json())
    .then(m => {
      currentId = m.id
      loadList()
    })
    .catch(() => alert('Error al guardar'))
}

function deleteMaterial(id) {
  fetch(`/api/resources/materials/${id}`, { method: 'DELETE' })
    .then(() => {
      if (currentId === id) {
        currentId = null
        newMaterial()
      }
      loadList()
    })
    .catch(() => alert('Error al eliminar'))
}

function escapeHtml(str) {
  if (!str) return ''
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

export function cleanupMaterialCreator() {
  if (preview) {
    preview.destroy()
    preview = null
  }
  currentId = null
}

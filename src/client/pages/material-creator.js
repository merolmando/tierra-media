import { initPreview } from '../components/material-preview.js'

let preview = null
let currentId = null
let textureCache = []
let pendingTexId = ''
let pendingNormId = ''

const DEFAULTS = {
  name: '',
  color: '#888888',
  roughness: 0.5,
  metalness: 0.1,
  emissiveColor: '#000000',
  emissiveIntensity: 0,
  weight: 1,
  strength: 50,
  stateOfMatter: 'solid',
  opacity: 1,
  textureId: null,
  textureScaleX: 1,
  textureScaleY: 1,
  textureInfluence: 1,
  normalMapId: null,
  normalMapInfluence: 1,
}

export function renderMaterialCreator() {
  const app = document.getElementById('app')
  app.innerHTML = `
    <div class="tool-header">
      <h1>Material Creator</h1>
      <button id="mc-new" class="btn-primary">+ Nuevo</button>
    </div>
    <div class="tool-layout">
      <div id="mc-list" class="tool-panel"></div>
      <div id="mc-preview" class="tool-viewport"></div>
      <div id="mc-props" class="tool-props"></div>
    </div>
  `

  document.getElementById('mc-new').addEventListener('click', () => newMaterial())

  renderProps(null)
  loadList()
  initPreviewContainer()
  loadTextureList()
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
      <div class="mc-list-item" data-id="${m.id}" style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:6px;cursor:pointer"
           onmouseenter="this.style.background='#2a2a2a'" onmouseleave="this.style.background='transparent'">
        <span style="width:14px;height:14px;border-radius:3px;display:inline-block;background:${m.color || '#888'};border:1px solid #555;flex-shrink:0"></span>
        <span style="flex:1;font-size:13px">${escapeHtml(m.name)}</span>
        <button class="btn-delete" data-id="${m.id}" style="background:none;border:none;color:#cc4444;cursor:pointer;font-size:14px;padding:0 4px" title="Eliminar">×</button>
      </div>
    `).join('')

  el.querySelectorAll('.mc-list-item').forEach(item => {
    item.addEventListener('click', e => {
      if (e.target.tagName === 'BUTTON') return
      loadMaterial(item.dataset.id)
    })
  })

  el.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      if (confirm('¿Eliminar este material?')) deleteMaterial(btn.dataset.id)
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
  renderProps({ ...DEFAULTS })
  preview.updateMaterial({ ...DEFAULTS })
  preview.setLightAngle(0)
  preview.setAutoRotate(true)
}

function loadTextureList() {
  fetch('/api/resources/textures')
    .then(r => r.json())
    .then(list => {
      textureCache = list
      populateTextureSelectors()
    })
    .catch(() => {})
}

function populateTextureSelectors() {
  const sel = document.getElementById('mc-texture')
  const norm = document.getElementById('mc-normalmap')
  if (!sel && !norm) return
  const opts = textureCache.map(t =>
    `<option value="${t.id}">${escapeHtml(t.name)}</option>`
  ).join('')
  const none = '<option value="">— Sin textura —</option>'
  if (sel) {
    sel.innerHTML = none + opts
    if (pendingTexId) sel.value = pendingTexId
  }
  if (norm) {
    norm.innerHTML = none + opts
    if (pendingNormId) norm.value = pendingNormId
  }
}

function renderProps(m) {
  const el = document.getElementById('mc-props')
  if (!m) {
    el.innerHTML = '<p style="color:#666;font-size:13px">Seleccioná o creá un material para editar.</p>'
    return
  }
  el.innerHTML = `
    <div style="font-size:12px;font-weight:600;color:#44aa88;margin-bottom:8px">BÁSICO</div>

    <label style="display:block;font-size:12px;color:#888;margin-bottom:4px">Nombre</label>
    <input id="mc-name" type="text" value="${escapeHtml(m.name || '')}" style="width:100%;margin-bottom:10px;background:#222;color:#ddd;border:1px solid #444;border-radius:6px;padding:6px 10px;font-size:13px">

    <label style="display:block;font-size:12px;color:#888;margin-bottom:4px">Color</label>
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
      <input id="mc-color" type="color" value="${m.color || '#888888'}" style="width:36px;height:28px;border:none;border-radius:4px;cursor:pointer;background:none;padding:0">
      <span id="mc-color-label" style="font-size:11px;color:#888">${m.color || '#888888'}</span>
    </div>

    <hr style="border:none;border-top:1px solid #2a2a2a;margin:12px 0">

    <div style="font-size:12px;font-weight:600;color:#44aa88;margin-bottom:8px">RENDER</div>

    <label style="display:block;font-size:12px;color:#888;margin-bottom:4px">Roughness <span id="mc-roughness-label" style="color:#666">${fmt(m.roughness, 2)}</span></label>
    <input id="mc-roughness" type="range" min="0" max="1" step="0.01" value="${m.roughness ?? 0.5}" style="width:100%;margin-bottom:8px;accent-color:#44aa88;height:4px">

    <label style="display:block;font-size:12px;color:#888;margin-bottom:4px">Metalness <span id="mc-metalness-label" style="color:#666">${fmt(m.metalness, 2)}</span></label>
    <input id="mc-metalness" type="range" min="0" max="1" step="0.01" value="${m.metalness ?? 0.1}" style="width:100%;margin-bottom:8px;accent-color:#44aa88;height:4px">

    <label style="display:block;font-size:12px;color:#888;margin-bottom:4px">Opacidad <span id="mc-opacity-label" style="color:#666">${fmt(m.opacity, 2)}</span></label>
    <input id="mc-opacity" type="range" min="0" max="1" step="0.01" value="${m.opacity ?? 1}" style="width:100%;margin-bottom:8px;accent-color:#44aa88;height:4px">

    <label style="display:block;font-size:12px;color:#888;margin-bottom:4px">Color emisivo</label>
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
      <input id="mc-emissive" type="color" value="${m.emissiveColor || '#000000'}" style="width:36px;height:28px;border:none;border-radius:4px;cursor:pointer;background:none;padding:0">
      <span id="mc-emissive-label" style="font-size:11px;color:#888">${m.emissiveColor || '#000000'}</span>
    </div>

    <label style="display:block;font-size:12px;color:#888;margin-bottom:4px">Intensidad emisiva <span id="mc-emissiveInt-label" style="color:#666">${fmt(m.emissiveIntensity, 1)}</span></label>
    <input id="mc-emissiveInt" type="range" min="0" max="10" step="0.1" value="${m.emissiveIntensity ?? 0}" style="width:100%;margin-bottom:10px;accent-color:#44aa88;height:4px">

    <hr style="border:none;border-top:1px solid #2a2a2a;margin:12px 0">

    <div style="font-size:12px;font-weight:600;color:#44aa88;margin-bottom:8px">PREVIEW</div>

    <label style="display:block;font-size:12px;color:#888;margin-bottom:4px">Ángulo de luz <span id="mc-light-label" style="color:#666">0°</span></label>
    <input id="mc-light" type="range" min="0" max="360" step="1" value="0" style="width:100%;margin-bottom:6px;accent-color:#44aa88;height:4px">

    <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#888;margin-bottom:10px;cursor:pointer">
      <input id="mc-autorotate" type="checkbox" checked style="accent-color:#44aa88"> Auto-rotar luz
    </label>

    <hr style="border:none;border-top:1px solid #2a2a2a;margin:12px 0">

    <div style="font-size:12px;font-weight:600;color:#44aa88;margin-bottom:8px">FÍSICA</div>

    <div style="display:flex;gap:8px;margin-bottom:8px">
      <div style="flex:1">
        <label style="display:block;font-size:12px;color:#888;margin-bottom:4px">Peso</label>
        <input id="mc-weight" type="number" min="0.1" step="0.1" value="${m.weight ?? 1}" style="width:100%;background:#222;color:#ddd;border:1px solid #444;border-radius:6px;padding:5px 8px;font-size:13px">
      </div>
      <div style="flex:1">
        <label style="display:block;font-size:12px;color:#888;margin-bottom:4px">Resistencia</label>
        <input id="mc-strength" type="number" min="0" step="1" value="${m.strength ?? 50}" style="width:100%;background:#222;color:#ddd;border:1px solid #444;border-radius:6px;padding:5px 8px;font-size:13px">
      </div>
    </div>

    <label style="display:block;font-size:12px;color:#888;margin-bottom:4px">Estado de la materia</label>
    <select id="mc-state" style="width:100%;margin-bottom:10px;background:#222;color:#ddd;border:1px solid #444;border-radius:6px;padding:5px 8px;font-size:13px">
      ${['solid','liquid','gas','plasma'].map(s =>
        `<option value="${s}" ${(m.stateOfMatter || 'solid') === s ? 'selected' : ''}>${s}</option>`
      ).join('')}
    </select>

    <hr style="border:none;border-top:1px solid #2a2a2a;margin:12px 0">

    <div style="font-size:12px;font-weight:600;color:#44aa88;margin-bottom:8px">TEXTURAS</div>

    <label style="display:block;font-size:12px;color:#888;margin-bottom:4px">Textura difusa</label>
    <select id="mc-texture" style="width:100%;margin-bottom:6px;background:#222;color:#ddd;border:1px solid #444;border-radius:6px;padding:5px 8px;font-size:13px">
      <option value="">— Sin textura —</option>
    </select>

    <div style="display:flex;gap:8px;margin-bottom:6px">
      <div style="flex:1">
        <label style="display:block;font-size:11px;color:#666;margin-bottom:2px">Escala X</label>
        <input id="mc-texScaleX" type="number" min="0.1" step="0.1" value="${m.textureScaleX ?? 1}" style="width:100%;background:#222;color:#ddd;border:1px solid #444;border-radius:6px;padding:4px 6px;font-size:12px">
      </div>
      <div style="flex:1">
        <label style="display:block;font-size:11px;color:#666;margin-bottom:2px">Escala Y</label>
        <input id="mc-texScaleY" type="number" min="0.1" step="0.1" value="${m.textureScaleY ?? 1}" style="width:100%;background:#222;color:#ddd;border:1px solid #444;border-radius:6px;padding:4px 6px;font-size:12px">
      </div>
    </div>

    <label style="display:block;font-size:12px;color:#888;margin-bottom:4px">Influencia <span id="mc-texInfl-label" style="color:#666">${fmt(m.textureInfluence, 2)}</span></label>
    <input id="mc-texInfl" type="range" min="0" max="1" step="0.01" value="${m.textureInfluence ?? 1}" style="width:100%;margin-bottom:10px;accent-color:#44aa88;height:4px">

    <label style="display:block;font-size:12px;color:#888;margin-bottom:4px">Normal map</label>
    <select id="mc-normalmap" style="width:100%;margin-bottom:10px;background:#222;color:#ddd;border:1px solid #444;border-radius:6px;padding:5px 8px;font-size:13px">
      <option value="">— Sin normal map —</option>
    </select>

    <label style="display:block;font-size:12px;color:#888;margin-bottom:4px">Influencia <span id="mc-normInfl-label" style="color:#666">${fmt(m.normalMapInfluence, 2)}</span></label>
    <input id="mc-normInfl" type="range" min="0" max="2" step="0.01" value="${m.normalMapInfluence ?? 1}" style="width:100%;margin-bottom:16px;accent-color:#44aa88;height:4px">

    <div style="display:flex;gap:8px;padding-top:4px;border-top:1px solid #2a2a2a">
      <button id="mc-save" class="btn-primary" style="flex:1">Guardar</button>
      <button id="mc-delete" class="btn-danger" ${!currentId ? 'disabled style="opacity:0.4"' : ''}>Eliminar</button>
    </div>
  `

  el.querySelector('#mc-name').addEventListener('input', updatePreview)
  el.querySelector('#mc-color').addEventListener('input', updatePreview)
  el.querySelector('#mc-roughness').addEventListener('input', updatePreview)
  el.querySelector('#mc-metalness').addEventListener('input', updatePreview)
  el.querySelector('#mc-opacity').addEventListener('input', updatePreview)
  el.querySelector('#mc-emissive').addEventListener('input', updatePreview)
  el.querySelector('#mc-emissiveInt').addEventListener('input', updatePreview)
  el.querySelector('#mc-texture').addEventListener('change', updatePreview)
  el.querySelector('#mc-texScaleX').addEventListener('input', updatePreview)
  el.querySelector('#mc-texScaleY').addEventListener('input', updatePreview)
  el.querySelector('#mc-texInfl').addEventListener('input', updatePreview)
  el.querySelector('#mc-normalmap').addEventListener('change', updatePreview)
  el.querySelector('#mc-normInfl').addEventListener('input', updatePreview)
  el.querySelector('#mc-light').addEventListener('input', updatePreview)
  el.querySelector('#mc-autorotate').addEventListener('change', updatePreview)
  el.querySelector('#mc-save').addEventListener('click', saveMaterial)

  pendingTexId = m.textureId || ''
  pendingNormId = m.normalMapId || ''

  const delBtn = el.querySelector('#mc-delete')
  if (currentId) {
    delBtn.addEventListener('click', () => {
      if (confirm('¿Eliminar este material?')) deleteMaterial(currentId)
    })
  }

  populateTextureSelectors()
}

function updatePreview() {
  const vals = readForm()
  if (!vals) return

  if (document.getElementById('mc-color-label')) {
    document.getElementById('mc-color-label').textContent = vals.color
  }
  const setLabel = (id, v, dec) => {
    const el = document.getElementById(id)
    if (el) el.textContent = typeof v === 'number' ? v.toFixed(dec) : v
  }
  setLabel('mc-roughness-label', vals.roughness, 2)
  setLabel('mc-metalness-label', vals.metalness, 2)
  setLabel('mc-opacity-label', vals.opacity, 2)
  setLabel('mc-emissive-label', vals.emissiveColor)
  setLabel('mc-emissiveInt-label', vals.emissiveIntensity, 1)
  setLabel('mc-texInfl-label', vals.textureInfluence, 2)
  setLabel('mc-normInfl-label', vals.normalMapInfluence, 2)
  setLabel('mc-light-label', vals.lightAngle, 0)

  if (preview) {
    preview.updateMaterial(vals)
    if (vals.lightAngle != null) preview.setLightAngle(vals.lightAngle)
    if (vals.autoRotate != null) preview.setAutoRotate(vals.autoRotate)
  }
}

function readForm() {
  const g = id => document.getElementById(id)
  const name = g('mc-name')?.value
  if (name == null) return null
  return {
    name: name || '',
    color: g('mc-color')?.value || '#888888',
    roughness: parseFloat(g('mc-roughness')?.value || 0.5),
    metalness: parseFloat(g('mc-metalness')?.value || 0.1),
    opacity: parseFloat(g('mc-opacity')?.value || 1),
    emissiveColor: g('mc-emissive')?.value || '#000000',
    emissiveIntensity: parseFloat(g('mc-emissiveInt')?.value || 0),
    weight: parseFloat(g('mc-weight')?.value || 1),
    strength: parseFloat(g('mc-strength')?.value || 50),
    stateOfMatter: g('mc-state')?.value || 'solid',
    textureId: g('mc-texture')?.value || null,
    textureScaleX: parseFloat(g('mc-texScaleX')?.value || 1),
    textureScaleY: parseFloat(g('mc-texScaleY')?.value || 1),
    textureInfluence: parseFloat(g('mc-texInfl')?.value || 1),
    normalMapId: g('mc-normalmap')?.value || null,
    normalMapInfluence: parseFloat(g('mc-normInfl')?.value || 1),
    lightAngle: parseFloat(g('mc-light')?.value || 0),
    autoRotate: g('mc-autorotate')?.checked ?? true,
  }
}

function saveMaterial() {
  const all = readForm()
  if (!all || !all.name.trim()) {
    alert('El nombre es obligatorio')
    return
  }
  const data = {
    name: all.name,
    color: all.color,
    roughness: all.roughness,
    metalness: all.metalness,
    opacity: all.opacity,
    emissiveColor: all.emissiveColor,
    emissiveIntensity: all.emissiveIntensity,
    weight: all.weight,
    strength: all.strength,
    stateOfMatter: all.stateOfMatter,
    textureId: all.textureId,
    textureScaleX: all.textureScaleX,
    textureScaleY: all.textureScaleY,
    textureInfluence: all.textureInfluence,
    normalMapId: all.normalMapId,
    normalMapInfluence: all.normalMapInfluence,
  }

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

function fmt(v, dec) {
  return v != null ? v.toFixed(dec) : '—'
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
  textureCache = []
  pendingTexId = ''
  pendingNormId = ''
}

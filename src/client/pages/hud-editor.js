let currentId = null
let elements = []
let selectedId = null
let textures = []
let previewCanvas = null
let previewCtx = null
let previewScale = 1
let isDragging = false
let dragStartX = 0
let dragStartY = 0
let dragOrigPos = { x: 0, y: 0 }
let hudData = { name: '', resolution: { width: 1920, height: 1080 } }

const ACTIONS = [
  'move_forward', 'move_backward', 'move_left', 'move_right',
  'jump', 'crouch', 'sprint',
  'interact', 'attack', 'block', 'use_item', 'inventory',
  'pause', 'menu', 'toggle_map', 'zoom_in', 'zoom_out',
]

const ANCHORS = ['top-left', 'top-center', 'top-right', 'center-left', 'center', 'center-right', 'bottom-left', 'bottom-center', 'bottom-right']
const BASE_COLORS = { bar: '#cc3333', text: '#ffffff', image: '#44aa88', button: '#336699' }

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 11)
}

function getElementDefault(type) {
  const base = {
    id: uuid(),
    type,
    label: type === 'text' ? 'Texto' : type.charAt(0).toUpperCase() + type.slice(1),
    anchor: 'top-left',
    position: { x: 100, y: 100 },
    size: { width: type === 'bar' ? 200 : 100, height: type === 'bar' ? 24 : 32 },
    opacity: 1,
    visible: true,
    borderColor: '#555555',
    borderWidth: 1,
    fillColor: BASE_COLORS[type],
    backgroundColor: '#222222',
  }
  if (type === 'text') {
    base.text = 'Texto'
    base.fontFamily = 'monospace'
    base.fontSize = 16
    base.fontColor = '#ffffff'
  }
  if (type === 'image') {
    base.textureId = null
  }
  if (type === 'button') {
    base.text = 'Botón'
    base.fontFamily = 'monospace'
    base.fontSize = 14
    base.fontColor = '#ffffff'
    base.fillColor = '#336699'
    base.textureId = null
    base.action = ''
  }
  return base
}

function getAnchorOffset(anchor, elW, elH, screenW, screenH) {
  switch (anchor) {
    case 'top-left': return { x: 0, y: 0 }
    case 'top-center': return { x: (screenW - elW) / 2, y: 0 }
    case 'top-right': return { x: screenW - elW, y: 0 }
    case 'center-left': return { x: 0, y: (screenH - elH) / 2 }
    case 'center': return { x: (screenW - elW) / 2, y: (screenH - elH) / 2 }
    case 'center-right': return { x: screenW - elW, y: (screenH - elH) / 2 }
    case 'bottom-left': return { x: 0, y: screenH - elH }
    case 'bottom-center': return { x: (screenW - elW) / 2, y: screenH - elH }
    case 'bottom-right': return { x: screenW - elW, y: screenH - elH }
    default: return { x: 0, y: 0 }
  }
}

function getElementScreenPos(el) {
  const r = hudData.resolution
  const off = getAnchorOffset(el.anchor, el.size.width, el.size.height, r.width, r.height)
  return { x: el.position.x + off.x, y: el.position.y + off.y }
}

function setElementFromScreenPos(el, sx, sy) {
  const r = hudData.resolution
  const off = getAnchorOffset(el.anchor, el.size.width, el.size.height, r.width, r.height)
  el.position.x = sx - off.x
  el.position.y = sy - off.y
}

function loadTextures() {
  fetch('/api/resources/textures')
    .then(r => r.json())
    .then(list => { textures = list })
    .catch(() => { textures = [] })
}

function renderHudPreview() {
  if (!previewCtx) return
  const canvas = previewCanvas
  const ctx = previewCtx
  const r = hudData.resolution
  const container = canvas.parentElement
  const maxW = container.clientWidth - 4
  const maxH = container.clientHeight - 4
  previewScale = Math.min(maxW / r.width, maxH / r.height, 1)
  canvas.width = r.width * previewScale
  canvas.height = r.height * previewScale
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  ctx.fillStyle = '#1a1a1a'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.fillStyle = '#2a2a2a'
  ctx.fillRect(2, 2, canvas.width - 4, canvas.height - 4)

  elements.forEach(el => {
    if (!el.visible) return
    const sp = getElementScreenPos(el)
    const x = sp.x * previewScale
    const y = sp.y * previewScale
    const w = el.size.width * previewScale
    const h = el.size.height * previewScale

    if (el.type === 'bar') {
      ctx.fillStyle = el.backgroundColor || '#222'
      ctx.fillRect(x, y, w, h)
      ctx.fillStyle = el.fillColor || '#cc3333'
      ctx.fillRect(x, y, w * 0.6, h)
    } else if (el.type === 'text') {
      ctx.font = `${el.fontSize * previewScale}px ${el.fontFamily || 'monospace'}`
      ctx.fillStyle = el.fontColor || '#fff'
      ctx.textBaseline = 'top'
      ctx.fillText(el.text || '', x, y)
    } else {
      ctx.fillStyle = el.fillColor || BASE_COLORS[el.type]
      ctx.fillRect(x, y, w, h)
    }

    if (el.borderWidth > 0) {
      ctx.strokeStyle = el.borderColor || '#555'
      ctx.lineWidth = el.borderWidth * previewScale
      ctx.strokeRect(x, y, w, h)
    }

    if (!el.label || el.type === 'text') return
    ctx.font = `${Math.max(8, 10 * previewScale)}px monospace`
    ctx.fillStyle = '#aaa'
    ctx.textBaseline = 'top'
    const lx = x + 4 * previewScale
    const ly = y + 4 * previewScale
    ctx.fillText(el.label, lx, ly)
  })

  if (selectedId) {
    const el = elements.find(e => e.id === selectedId)
    if (el && el.visible) {
      const sp = getElementScreenPos(el)
      const x = sp.x * previewScale
      const y = sp.y * previewScale
      const w = el.size.width * previewScale
      const h = el.size.height * previewScale
      ctx.strokeStyle = '#44ccff'
      ctx.lineWidth = 2
      ctx.setLineDash([4, 4])
      ctx.strokeRect(x - 2, y - 2, w + 4, h + 4)
      ctx.setLineDash([])

      ctx.fillStyle = '#44ccff'
      const hx = [x, x + w, x + w, x]
      const hy = [y, y, y + h, y + h]
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(hx[i] - 3, hy[i] - 3, 6, 6)
      }
    }
  }
}

function findElementAtCanvas(cx, cy) {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i]
    if (!el.visible) continue
    const sp = getElementScreenPos(el)
    const sx = sp.x * previewScale
    const sy = sp.y * previewScale
    const sw = el.size.width * previewScale
    const sh = el.size.height * previewScale
    if (cx >= sx && cx <= sx + sw && cy >= sy && cy <= sy + sh) {
      return el
    }
  }
  return null
}

function onCanvasMouseDown(e) {
  const rect = previewCanvas.getBoundingClientRect()
  const cx = e.clientX - rect.left
  const cy = e.clientY - rect.top
  const el = findElementAtCanvas(cx, cy)
  if (el) {
    selectedId = el.id
    isDragging = true
    dragStartX = cx
    dragStartY = cy
    dragOrigPos.x = el.position.x
    dragOrigPos.y = el.position.y
    renderPrimitiveEditor()
    renderHudPreview()
    renderElementList()
  } else {
    selectedId = null
    isDragging = false
    renderPrimitiveEditor()
    renderHudPreview()
    renderElementList()
  }
}

function onCanvasMouseMove(e) {
  if (!isDragging || !selectedId) return
  const rect = previewCanvas.getBoundingClientRect()
  const cx = e.clientX - rect.left
  const cy = e.clientY - rect.top
  const dx = (cx - dragStartX) / previewScale
  const dy = (cy - dragStartY) / previewScale
  const el = elements.find(e => e.id === selectedId)
  if (!el) return
  el.position.x = dragOrigPos.x + dx
  el.position.y = dragOrigPos.y + dy
  renderHudPreview()
  syncEditorInputs(el)
}

function onCanvasMouseUp() {
  if (isDragging) {
    isDragging = false
    renderPrimitiveEditor()
  }
}

function addElement(type) {
  const el = getElementDefault(type)
  elements.push(el)
  selectedId = el.id
  renderElementList()
  renderHudPreview()
  renderPrimitiveEditor()
}

function deleteSelected() {
  if (!selectedId) return
  const idx = elements.findIndex(e => e.id === selectedId)
  if (idx === -1) return
  elements.splice(idx, 1)
  selectedId = elements.length > 0 ? elements[elements.length - 1].id : null
  renderElementList()
  renderHudPreview()
  renderPrimitiveEditor()
}

function duplicateSelected() {
  if (!selectedId) return
  const src = elements.find(e => e.id === selectedId)
  if (!src) return
  const el = JSON.parse(JSON.stringify(src))
  el.id = uuid()
  el.position.x += 20
  el.position.y += 20
  elements.push(el)
  selectedId = el.id
  renderElementList()
  renderHudPreview()
  renderPrimitiveEditor()
}

function moveElementUp() {
  const idx = elements.findIndex(e => e.id === selectedId)
  if (idx < 1) return
  ;[elements[idx - 1], elements[idx]] = [elements[idx], elements[idx - 1]]
  renderElementList()
  renderHudPreview()
}

function moveElementDown() {
  const idx = elements.findIndex(e => e.id === selectedId)
  if (idx === -1 || idx >= elements.length - 1) return
  ;[elements[idx], elements[idx + 1]] = [elements[idx + 1], elements[idx]]
  renderElementList()
  renderHudPreview()
}

function renderElementList() {
  const container = document.getElementById('he-element-list')
  if (!container) return
  if (elements.length === 0) {
    container.innerHTML = '<p style="color:#666;font-size:12px;padding:4px">Sin elementos.</p>'
    return
  }
  container.innerHTML = elements.map(el => {
    const sel = el.id === selectedId ? 'selected' : ''
    const vis = el.visible ? '👁' : '👁‍🗨'
    return `<div class="he-el-item ${sel}" data-id="${el.id}" style="display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:4px;cursor:pointer;font-size:12px;${el.id === selectedId ? 'background:#2a4a3a;color:#fff' : 'color:#ccc'}"
       onmouseenter="this.style.background='${el.id === selectedId ? '#2a4a3a' : '#2a2a2a'}'" onmouseleave="this.style.background='${el.id === selectedId ? '#2a4a3a' : 'transparent'}'">
      <span style="font-size:10px;width:16px;text-align:center">${vis}</span>
      <span style="flex:1">${escapeHtml(el.label || el.type)}</span>
      <span style="font-size:10px;color:#888">${el.type}</span>
    </div>`
  }).join('')

  container.querySelectorAll('.he-el-item').forEach(item => {
    item.addEventListener('click', () => {
      selectedId = item.dataset.id
      renderElementList()
      renderHudPreview()
      renderPrimitiveEditor()
    })
  })
}

function renderPrimitiveEditor() {
  const container = document.getElementById('he-props')
  if (!container) return
  const el = elements.find(e => e.id === selectedId)
  if (!el) {
    container.innerHTML = '<p style="color:#666;font-size:13px;padding:8px">Seleccioná un elemento para editar.</p>'
    return
  }

  const r = hudData.resolution
  const anchorOpts = ANCHORS.map(a => `<option value="${a}"${a === el.anchor ? ' selected' : ''}>${a}</option>`).join('')

  container.innerHTML = `
    <div class="tool-section-title">ELEMENTO</div>
    <label>Nombre</label>
    <input id="he-field-label" type="text" value="${escapeHtml(el.label)}">

    <label>Tipo</label>
    <select id="he-field-type">
      <option value="bar"${el.type === 'bar' ? ' selected' : ''}>Bar</option>
      <option value="text"${el.type === 'text' ? ' selected' : ''}>Text</option>
      <option value="image"${el.type === 'image' ? ' selected' : ''}>Image</option>
      <option value="button"${el.type === 'button' ? ' selected' : ''}>Button</option>
    </select>

    <label>Ancla</label>
    <select id="he-field-anchor">${anchorOpts}</select>

    <hr>

    <div class="tool-section-title">POSICIÓN (px)</div>
    <div style="display:flex;gap:4px;margin-bottom:6px">
      <div style="flex:1">
        <div style="font-size:10px;color:#666">X</div>
        <input id="he-field-px" type="number" step="1" value="${Math.round(el.position.x)}" style="width:100%">
      </div>
      <div style="flex:1">
        <div style="font-size:10px;color:#666">Y</div>
        <input id="he-field-py" type="number" step="1" value="${Math.round(el.position.y)}" style="width:100%">
      </div>
    </div>

    <div class="tool-section-title">TAMAÑO (px)</div>
    <div style="display:flex;gap:4px;margin-bottom:6px">
      <div style="flex:1">
        <div style="font-size:10px;color:#666">Ancho</div>
        <input id="he-field-sw" type="number" step="1" min="1" value="${Math.round(el.size.width)}" style="width:100%">
      </div>
      <div style="flex:1">
        <div style="font-size:10px;color:#666">Alto</div>
        <input id="he-field-sh" type="number" step="1" min="1" value="${Math.round(el.size.height)}" style="width:100%">
      </div>
    </div>

    <hr>

    <div class="tool-section-title">APARIENCIA</div>

    <label>
      <input id="he-field-visible" type="checkbox" ${el.visible ? 'checked' : ''}>
      Visible
    </label>

    <label>Opacidad</label>
    <input id="he-field-opacity" type="range" min="0" max="1" step="0.05" value="${el.opacity}">

    ${el.type !== 'text' ? `
    <label>Color de relleno</label>
    <input id="he-field-fill" type="color" value="${el.fillColor || BASE_COLORS[el.type]}">
    ` : ''}

    ${el.type !== 'text' && el.type !== 'image' ? `
    <label>Color de fondo</label>
    <input id="he-field-bg" type="color" value="${el.backgroundColor || '#222222'}">
    ` : ''}

    <label>Borde</label>
    <div style="display:flex;gap:4px;margin-bottom:6px">
      <div style="flex:2">
        <input id="he-field-border" type="color" value="${el.borderColor || '#555555'}">
      </div>
      <div style="flex:1">
        <input id="he-field-borderw" type="number" step="1" min="0" max="10" value="${el.borderWidth || 0}" style="width:100%">
      </div>
    </div>

    ${el.type === 'text' || el.type === 'button' ? `
    <hr>
    <div class="tool-section-title">TEXTO</div>
    <label>Texto</label>
    <input id="he-field-text" type="text" value="${escapeHtml(el.text || '')}">
    <label>Fuente</label>
    <select id="he-field-font">
      <option value="monospace"${el.fontFamily === 'monospace' ? ' selected' : ''}>Monospace</option>
      <option value="sans-serif"${el.fontFamily === 'sans-serif' ? ' selected' : ''}>Sans-serif</option>
      <option value="serif"${el.fontFamily === 'serif' ? ' selected' : ''}>Serif</option>
    </select>
    <div style="display:flex;gap:4px;margin-bottom:6px">
      <div style="flex:2">
        <label>Color</label>
        <input id="he-field-fcolor" type="color" value="${el.fontColor || '#ffffff'}">
      </div>
      <div style="flex:1">
        <label>Tamaño</label>
        <input id="he-field-fsize" type="number" step="1" min="6" max="120" value="${el.fontSize || 16}" style="width:100%">
      </div>
    </div>
    ` : ''}

    ${el.type === 'image' || el.type === 'button' ? `
    <hr>
    <label>Textura</label>
    <select id="he-field-texture">
      <option value="">— Sin textura —</option>
      ${textures.map(t => `<option value="${t.id}"${t.id === el.textureId ? ' selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}
    </select>
    ` : ''}

    ${el.type === 'button' ? `
    <label>Acción</label>
    <select id="he-field-action">
      <option value="">— Ninguna —</option>
      ${ACTIONS.map(a => `<option value="${a}"${a === el.action ? ' selected' : ''}>${escapeHtml(a)}</option>`).join('')}
    </select>
    ` : ''}
  `

  const bind = (id, cb) => {
    const inp = document.getElementById(id)
    if (inp) inp.addEventListener('input', cb)
  }

  bind('he-field-label', () => {
    const v = document.getElementById('he-field-label').value
    el.label = v
    renderElementList()
    renderHudPreview()
  })
  bind('he-field-type', () => {
    const v = document.getElementById('he-field-type').value
    el.type = v
    renderPrimitiveEditor()
    renderElementList()
    renderHudPreview()
  })
  bind('he-field-anchor', () => {
    el.anchor = document.getElementById('he-field-anchor').value
    renderHudPreview()
  })
  bind('he-field-px', () => {
    el.position.x = parseFloat(document.getElementById('he-field-px').value) || 0
    renderHudPreview()
  })
  bind('he-field-py', () => {
    el.position.y = parseFloat(document.getElementById('he-field-py').value) || 0
    renderHudPreview()
  })
  bind('he-field-sw', () => {
    el.size.width = Math.max(1, parseFloat(document.getElementById('he-field-sw').value) || 1)
    renderHudPreview()
    renderElementList()
  })
  bind('he-field-sh', () => {
    el.size.height = Math.max(1, parseFloat(document.getElementById('he-field-sh').value) || 1)
    renderHudPreview()
    renderElementList()
  })
  bind('he-field-visible', () => {
    el.visible = document.getElementById('he-field-visible').checked
    renderElementList()
    renderHudPreview()
  })
  bind('he-field-opacity', () => {
    el.opacity = parseFloat(document.getElementById('he-field-opacity').value) || 1
  })
  bind('he-field-fill', () => {
    el.fillColor = document.getElementById('he-field-fill').value
    renderHudPreview()
  })
  bind('he-field-bg', () => {
    el.backgroundColor = document.getElementById('he-field-bg').value
    renderHudPreview()
  })
  bind('he-field-border', () => {
    el.borderColor = document.getElementById('he-field-border').value
    renderHudPreview()
  })
  bind('he-field-borderw', () => {
    el.borderWidth = parseInt(document.getElementById('he-field-borderw').value) || 0
    renderHudPreview()
  })
  bind('he-field-text', () => {
    el.text = document.getElementById('he-field-text').value
    renderHudPreview()
  })
  bind('he-field-font', () => {
    el.fontFamily = document.getElementById('he-field-font').value
    renderHudPreview()
  })
  bind('he-field-fcolor', () => {
    el.fontColor = document.getElementById('he-field-fcolor').value
    renderHudPreview()
  })
  bind('he-field-fsize', () => {
    el.fontSize = parseInt(document.getElementById('he-field-fsize').value) || 16
    renderHudPreview()
  })
  bind('he-field-texture', () => {
    el.textureId = document.getElementById('he-field-texture').value || null
  })
  const actionSel = document.getElementById('he-field-action')
  if (actionSel) {
    actionSel.addEventListener('change', () => {
      el.action = actionSel.value
    })
  }
}

function syncEditorInputs(el) {
  const setNum = (id, v) => {
    const inp = document.getElementById(id)
    if (inp) inp.value = Math.round(v)
  }
  setNum('he-field-px', el.position.x)
  setNum('he-field-py', el.position.y)
}

function renderHudList() {
  const container = document.getElementById('he-hud-list')
  if (!container) return
  fetch('/api/resources/huds')
    .then(r => r.json())
    .then(list => {
      if (list.length === 0) {
        container.innerHTML = '<p style="color:#666;font-size:12px;padding:4px">Sin HUDs.</p>'
        return
      }
      container.innerHTML = list.map(t => `
        <div class="he-hud-item" data-id="${t.id}" style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:6px;cursor:pointer"
             onmouseenter="this.style.background='#2a2a2a'" onmouseleave="this.style.background='transparent'">
          <span style="font-size:13px;flex:1">${escapeHtml(t.name)}</span>
          <button class="btn-delete" data-id="${t.id}" style="background:none;border:none;color:#cc4444;cursor:pointer;font-size:14px;padding:0 4px" title="Eliminar">×</button>
        </div>
      `).join('')

      container.querySelectorAll('.he-hud-item').forEach(item => {
        item.addEventListener('click', e => {
          if (e.target.tagName === 'BUTTON') return
          loadHud(item.dataset.id)
        })
      })
      container.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation()
          if (confirm('¿Eliminar este HUD?')) deleteHud(btn.dataset.id)
        })
      })
    })
    .catch(() => {
      container.innerHTML = '<p style="color:#666;font-size:12px">Error al cargar.</p>'
    })
}

function loadHud(id) {
  fetch(`/api/resources/huds/${id}`)
    .then(r => r.json())
    .then(data => {
      currentId = data.id
      hudData = { name: data.name, resolution: { ...data.resolution } }
      elements = data.elements.map(el => JSON.parse(JSON.stringify(el)))
      selectedId = null
      document.getElementById('he-name').value = hudData.name
      renderHudList()
      renderElementList()
      renderHudPreview()
      renderPrimitiveEditor()
    })
    .catch(() => alert('Error al cargar HUD'))
}

function deleteHud(id) {
  fetch(`/api/resources/huds/${id}`, { method: 'DELETE' })
    .then(() => {
      if (currentId === id) {
        currentId = null
        hudData = { name: '', resolution: { width: 1920, height: 1080 } }
        elements = []
        selectedId = null
        document.getElementById('he-name').value = ''
        renderPrimitiveEditor()
        renderHudPreview()
        renderElementList()
      }
      renderHudList()
    })
    .catch(() => alert('Error al eliminar'))
}

function saveHud() {
  const name = document.getElementById('he-name').value
  if (!name || !name.trim()) {
    alert('El nombre es obligatorio')
    return
  }

  const data = {
    name: name.trim(),
    resolution: hudData.resolution,
    elements: elements.map(el => {
      const copy = JSON.parse(JSON.stringify(el))
      return copy
    }),
  }

  const method = currentId ? 'PUT' : 'POST'
  const url = currentId ? `/api/resources/huds/${currentId}` : '/api/resources/huds'

  fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
    .then(r => r.json())
    .then(saved => {
      currentId = saved.id
      hudData.name = saved.name
      renderHudList()
    })
    .catch(() => alert('Error al guardar'))
}

function escapeHtml(str) {
  if (!str) return ''
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function renderHudEditor() {
  loadTextures()

  const app = document.getElementById('app')
  app.innerHTML = `
    <div class="tool-header">
      <h1>HUD Editor</h1>
      <div id="he-hud-info" style="font-size:13px;color:#888">
        Resolución:
        <input id="he-resw" type="number" step="1" value="${hudData.resolution.width}" style="width:60px;background:#222;color:#ddd;border:1px solid #444;border-radius:4px;padding:2px 5px;font-size:12px;text-align:center">
        ×
        <input id="he-resh" type="number" step="1" value="${hudData.resolution.height}" style="width:60px;background:#222;color:#ddd;border:1px solid #444;border-radius:4px;padding:2px 5px;font-size:12px;text-align:center">
      </div>
    </div>

    <div class="tool-layout">
      <div class="tool-panel">
        <div style="display:flex;gap:4px;margin-bottom:8px">
          <input id="he-name" type="text" placeholder="Nombre del HUD" value="${escapeHtml(hudData.name)}" style="flex:1;background:#222;color:#ddd;border:1px solid #444;border-radius:6px;padding:5px 8px;font-size:13px">
          <button id="he-save" class="btn-primary">Guardar</button>
        </div>
        <div id="he-hud-list"></div>
        <hr style="border:none;border-top:1px solid #2a2a2a;margin:12px 0">
        <div style="font-size:12px;font-weight:600;color:#44aa88;margin-bottom:8px">ELEMENTOS</div>
        <div style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap">
          <button class="he-add-el" data-type="bar" style="padding:4px 8px;border-radius:4px;border:1px solid #444;background:#222;color:#ddd;cursor:pointer;font-size:11px">+ Bar</button>
          <button class="he-add-el" data-type="text" style="padding:4px 8px;border-radius:4px;border:1px solid #444;background:#222;color:#ddd;cursor:pointer;font-size:11px">+ Text</button>
          <button class="he-add-el" data-type="image" style="padding:4px 8px;border-radius:4px;border:1px solid #444;background:#222;color:#ddd;cursor:pointer;font-size:11px">+ Image</button>
          <button class="he-add-el" data-type="button" style="padding:4px 8px;border-radius:4px;border:1px solid #444;background:#222;color:#ddd;cursor:pointer;font-size:11px">+ Button</button>
        </div>
        <div id="he-element-list"></div>
        <div style="display:flex;gap:4px;margin-top:6px">
          <button id="he-delete" style="padding:4px 8px;border-radius:4px;border:1px solid #444;background:#222;color:#cc4444;cursor:pointer;font-size:11px">Eliminar</button>
          <button id="he-dup" style="padding:4px 8px;border-radius:4px;border:1px solid #444;background:#222;color:#ddd;cursor:pointer;font-size:11px">Duplicar</button>
        </div>
        <div style="display:flex;gap:4px;margin-top:4px">
          <button id="he-up" style="padding:2px 8px;border-radius:4px;border:1px solid #444;background:#222;color:#ddd;cursor:pointer;font-size:11px">↑ Subir</button>
          <button id="he-down" style="padding:2px 8px;border-radius:4px;border:1px solid #444;background:#222;color:#ddd;cursor:pointer;font-size:11px">↓ Bajar</button>
        </div>
      </div>

      <div class="tool-viewport" id="he-viewport" style="overflow:hidden;position:relative">
        <canvas id="he-canvas" style="display:block;cursor:crosshair"></canvas>
      </div>

      <div class="tool-props" id="he-props">
        <p style="color:#666;font-size:13px;padding:8px">Seleccioná un elemento para editar.</p>
      </div>
    </div>
  `

  previewCanvas = document.getElementById('he-canvas')
  previewCtx = previewCanvas.getContext('2d')

  previewCanvas.addEventListener('mousedown', onCanvasMouseDown)
  previewCanvas.addEventListener('mousemove', onCanvasMouseMove)
  previewCanvas.addEventListener('mouseup', onCanvasMouseUp)

  document.getElementById('he-save').addEventListener('click', saveHud)

  document.querySelectorAll('.he-add-el').forEach(btn => {
    btn.addEventListener('click', () => addElement(btn.dataset.type))
  })

  document.getElementById('he-delete').addEventListener('click', deleteSelected)
  document.getElementById('he-dup').addEventListener('click', duplicateSelected)
  document.getElementById('he-up').addEventListener('click', moveElementUp)
  document.getElementById('he-down').addEventListener('click', moveElementDown)

  document.getElementById('he-name').addEventListener('input', () => {
    hudData.name = document.getElementById('he-name').value
  })

  const resInputs = ['he-resw', 'he-resh']
  resInputs.forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      hudData.resolution.width = parseInt(document.getElementById('he-resw').value) || 1920
      hudData.resolution.height = parseInt(document.getElementById('he-resh').value) || 1080
      renderHudPreview()
    })
  })

  renderHudList()
  renderElementList()
  renderHudPreview()
  renderPrimitiveEditor()
}

export function cleanupHudEditor() {
  if (previewCanvas) {
    previewCanvas.removeEventListener('mousedown', onCanvasMouseDown)
    previewCanvas.removeEventListener('mousemove', onCanvasMouseMove)
    previewCanvas.removeEventListener('mouseup', onCanvasMouseUp)
  }
  currentId = null
  elements = []
  selectedId = null
  textures = []
  previewCanvas = null
  previewCtx = null
}

let currentId = null
let diffuseCanvas = null
let normalCanvas = null
let displayCanvas = null
let displayCtx = null
let isDrawing = false
let brushColor = '#888888'
let brushSize = 4
let tool = 'brush'
let activeLayer = 'diffuse'
let textureSize = 64
let materialList = []

export function renderTexturePainter() {
  const app = document.getElementById('app')
  app.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h1 style="margin:0">Texture Painter</h1>
      <button id="tp-new" class="btn-primary">+ Nueva</button>
    </div>
    <div id="tp-layout" style="display:grid;grid-template-columns:200px 1fr 240px;gap:16px;height:calc(100vh - 180px)">
      <div id="tp-list" style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:8px;overflow-y:auto"></div>
      <div id="tp-canvas-container" style="background:#1a1a1a;border:1px solid #333;border-radius:8px;overflow:hidden;display:flex;align-items:center;justify-content:center"></div>
      <div id="tp-props" style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:16px;overflow-y:auto"></div>
    </div>
  `

  document.getElementById('tp-new').addEventListener('click', () => newTexture())
  renderProps(null)
  loadList()
  loadMaterials()
}

function newTexture() {
  currentId = null
  textureSize = 64
  initCanvases(textureSize)
  fillCanvas(diffuseCanvas, '#888888')
  fillCanvas(normalCanvas, '#8080ff')
  renderToDisplay()
  renderProps({ name: '', size: textureSize })
}

function initCanvases(size) {
  diffuseCanvas = document.createElement('canvas')
  diffuseCanvas.width = size
  diffuseCanvas.height = size
  const dctx = diffuseCanvas.getContext('2d')
  dctx.fillStyle = '#888888'
  dctx.fillRect(0, 0, size, size)

  normalCanvas = document.createElement('canvas')
  normalCanvas.width = size
  normalCanvas.height = size
  const nctx = normalCanvas.getContext('2d')
  nctx.fillStyle = '#8080ff'
  nctx.fillRect(0, 0, size, size)

  setupDisplay()
}

function setupDisplay() {
  const container = document.getElementById('tp-canvas-container')
  container.innerHTML = ''
  displayCanvas = document.createElement('canvas')
  displayCanvas.style.maxWidth = '100%'
  displayCanvas.style.maxHeight = '100%'
  displayCanvas.style.cursor = 'crosshair'
  displayCanvas.style.imageRendering = 'pixelated'
  container.appendChild(displayCanvas)
  displayCtx = displayCanvas.getContext('2d')

  displayCanvas.addEventListener('mousedown', onMouseDown)
  displayCanvas.addEventListener('mousemove', onMouseMove)
  displayCanvas.addEventListener('mouseup', onMouseUp)
  displayCanvas.addEventListener('mouseleave', onMouseUp)
}

function renderToDisplay() {
  if (!displayCanvas || !diffuseCanvas) return
  const src = activeLayer === 'normal' ? normalCanvas : diffuseCanvas
  displayCanvas.width = src.width
  displayCanvas.height = src.height
  displayCtx.drawImage(src, 0, 0)
}

function fillCanvas(c, color) {
  const ctx = c.getContext('2d')
  ctx.fillStyle = color
  ctx.fillRect(0, 0, c.width, c.height)
}

function getCanvasCoords(e) {
  const rect = displayCanvas.getBoundingClientRect()
  const scaleX = displayCanvas.width / rect.width
  const scaleY = displayCanvas.height / rect.height
  return {
    x: Math.floor((e.clientX - rect.left) * scaleX),
    y: Math.floor((e.clientY - rect.top) * scaleY),
  }
}

function onMouseDown(e) {
  isDrawing = true
  paint(e)
}

function onMouseMove(e) {
  if (!isDrawing) return
  paint(e)
}

function onMouseUp() {
  isDrawing = false
}

function paint(e) {
  const src = activeLayer === 'normal' ? normalCanvas : diffuseCanvas
  const ctx = src.getContext('2d')
  const pos = getCanvasCoords(e)
  const size = brushSize

  if (tool === 'fill') {
    ctx.fillStyle = brushColor
    ctx.fillRect(0, 0, src.width, src.height)
  } else if (tool === 'eraser') {
    ctx.save()
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, size / 2, 0, Math.PI * 2)
    ctx.clip()
    ctx.clearRect(0, 0, src.width, src.height)
    ctx.restore()
  } else {
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, size / 2, 0, Math.PI * 2)
    ctx.fillStyle = brushColor
    ctx.fill()
  }

  renderToDisplay()
}

function loadList() {
  fetch('/api/resources/textures')
    .then(r => r.json())
    .then(list => renderList(list))
    .catch(() => renderList([]))
}

function renderList(list) {
  const el = document.getElementById('tp-list')
  el.innerHTML = list.length === 0
    ? '<p style="color:#666;font-size:13px;padding:8px">Sin texturas aún.</p>'
    : list.map(t => `
      <div class="tp-list-item" data-id="${t.id}" style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:6px;cursor:pointer"
           onmouseenter="this.style.background='#2a2a2a'" onmouseleave="this.style.background='transparent'">
        <span style="font-size:13px;flex:1">${escapeHtml(t.name)}</span>
        <button class="btn-delete" data-id="${t.id}" style="background:none;border:none;color:#cc4444;cursor:pointer;font-size:14px;padding:0 4px" title="Eliminar">×</button>
      </div>
    `).join('')

  el.querySelectorAll('.tp-list-item').forEach(item => {
    item.addEventListener('click', e => {
      if (e.target.tagName === 'BUTTON') return
      loadTexture(item.dataset.id)
    })
  })
  el.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      if (confirm('¿Eliminar esta textura?')) deleteTexture(btn.dataset.id)
    })
  })
}

function loadTexture(id) {
  fetch(`/api/resources/textures/${id}`)
    .then(r => r.json())
    .then(t => {
      currentId = t.id
      textureSize = t.width || 512
      loadImageToCanvas(t.image, diffuseCanvas || document.createElement('canvas'), () => {
        if (t.normalMap) {
          loadImageToCanvas(t.normalMap, normalCanvas || document.createElement('canvas'), () => {
            renderToDisplay()
            renderProps(t)
          })
        } else {
          fillCanvas(normalCanvas, '#8080ff')
          renderToDisplay()
          renderProps(t)
        }
      })
    })
    .catch(() => {})
}

function loadImageToCanvas(dataUrl, canvas, cb) {
  const img = new Image()
  img.onload = () => {
    canvas.width = img.width
    canvas.height = img.height
    canvas.getContext('2d').drawImage(img, 0, 0)
    if (cb) cb()
  }
  img.src = dataUrl
}

function loadMaterials() {
  fetch('/api/resources/materials')
    .then(r => r.json())
    .then(list => {
      materialList = list
      populateBrushSelect()
    })
    .catch(() => {})
}

function populateBrushSelect() {
  const sel = document.getElementById('tp-brush-mat')
  if (!sel) return
  sel.innerHTML = '<option value="">— Seleccionar material —</option>' +
    materialList.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('')
}

function renderProps(t) {
  const el = document.getElementById('tp-props')
  if (!t) {
    el.innerHTML = '<p style="color:#666;font-size:13px">Seleccioná o creá una textura para editar.</p>'
    return
  }
  el.innerHTML = `
    <div style="font-size:12px;font-weight:600;color:#44aa88;margin-bottom:8px">PROPIEDADES</div>

    <label style="display:block;font-size:12px;color:#888;margin-bottom:4px">Nombre</label>
    <input id="tp-name" type="text" value="${escapeHtml(t.name || '')}" style="width:100%;margin-bottom:10px;background:#222;color:#ddd;border:1px solid #444;border-radius:6px;padding:6px 10px;font-size:13px">

    ${!currentId ? `
    <label style="display:block;font-size:12px;color:#888;margin-bottom:4px">Tamaño</label>
    <select id="tp-size" style="width:100%;margin-bottom:16px;background:#222;color:#ddd;border:1px solid #444;border-radius:6px;padding:5px 8px;font-size:13px">
      ${[64, 128, 256].map(s => `<option value="${s}" ${(t.size || 64) === s ? 'selected' : ''}>${s}×${s}</option>`).join('')}
    </select>
    <button id="tp-apply-size" class="btn-primary" style="width:100%;margin-bottom:16px">Aplicar tamaño</button>
    ` : ''}

    <hr style="border:none;border-top:1px solid #2a2a2a;margin:12px 0">

    <div style="font-size:12px;font-weight:600;color:#44aa88;margin-bottom:8px">HERRAMIENTAS</div>

    <div style="display:flex;gap:4px;margin-bottom:10px">
      <button class="tp-tool-btn ${tool === 'brush' ? 'tp-tool-active' : ''}" data-tool="brush" style="flex:1;padding:6px;border-radius:4px;border:1px solid #444;background:#222;color:#ddd;cursor:pointer;font-size:13px;text-align:center">🖌</button>
      <button class="tp-tool-btn ${tool === 'eraser' ? 'tp-tool-active' : ''}" data-tool="eraser" style="flex:1;padding:6px;border-radius:4px;border:1px solid #444;background:#222;color:#ddd;cursor:pointer;font-size:13px;text-align:center">🧹</button>
      <button class="tp-tool-btn ${tool === 'fill' ? 'tp-tool-active' : ''}" data-tool="fill" style="flex:1;padding:6px;border-radius:4px;border:1px solid #444;background:#222;color:#ddd;cursor:pointer;font-size:13px;text-align:center">🪣</button>
    </div>

    <label style="display:block;font-size:12px;color:#888;margin-bottom:4px">Tamaño de pincel <span id="tp-brush-size-label" style="color:#666">${brushSize}px</span></label>
    <input id="tp-brush-size" type="range" min="1" max="32" step="1" value="${brushSize}" style="width:100%;margin-bottom:12px;accent-color:#44aa88;height:4px">

    <label style="display:block;font-size:12px;color:#888;margin-bottom:4px">Pincel (material)</label>
    <select id="tp-brush-mat" style="width:100%;margin-bottom:16px;background:#222;color:#ddd;border:1px solid #444;border-radius:6px;padding:5px 8px;font-size:13px">
      <option value="">— Seleccionar material —</option>
    </select>

    <hr style="border:none;border-top:1px solid #2a2a2a;margin:12px 0">

    <div style="font-size:12px;font-weight:600;color:#44aa88;margin-bottom:8px">CAPA</div>

    <div style="display:flex;gap:4px;margin-bottom:16px">
      <button class="tp-layer-btn ${activeLayer === 'diffuse' ? 'tp-layer-active' : ''}" data-layer="diffuse" style="flex:1;padding:6px;border-radius:4px;border:1px solid #444;background:#222;color:#ddd;cursor:pointer;font-size:12px">Difusa</button>
      <button class="tp-layer-btn ${activeLayer === 'normal' ? 'tp-layer-active' : ''}" data-layer="normal" style="flex:1;padding:6px;border-radius:4px;border:1px solid #444;background:#222;color:#ddd;cursor:pointer;font-size:12px">Normal</button>
    </div>

    <div style="display:flex;gap:8px;padding-top:4px;border-top:1px solid #2a2a2a">
      <button id="tp-save" class="btn-primary" style="flex:1">Guardar</button>
      <button id="tp-delete" class="btn-danger" ${!currentId ? 'disabled style="opacity:0.4"' : ''}>Eliminar</button>
    </div>
  `

  el.querySelector('#tp-name').addEventListener('input', () => {})
  el.querySelectorAll('.tp-tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      tool = btn.dataset.tool
      el.querySelectorAll('.tp-tool-btn').forEach(b => b.classList.remove('tp-tool-active'))
      btn.classList.add('tp-tool-active')
    })
  })
  el.querySelectorAll('.tp-layer-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeLayer = btn.dataset.layer
      el.querySelectorAll('.tp-layer-btn').forEach(b => b.classList.remove('tp-layer-active'))
      btn.classList.add('tp-layer-active')
      renderToDisplay()
    })
  })
  el.querySelector('#tp-brush-size').addEventListener('input', () => {
    brushSize = parseInt(el.querySelector('#tp-brush-size').value)
    document.getElementById('tp-brush-size-label').textContent = brushSize + 'px'
  })
  el.querySelector('#tp-brush-mat').addEventListener('change', e => {
    const matId = e.target.value
    if (!matId) return
    fetch(`/api/resources/materials/${matId}`)
      .then(r => r.json())
      .then(mat => {
        brushColor = mat.color || '#888888'
      })
      .catch(() => {})
  })
  el.querySelector('#tp-save').addEventListener('click', saveTexture)
  if (!currentId) {
    const applyBtn = el.querySelector('#tp-apply-size')
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        const newSize = parseInt(document.getElementById('tp-size').value)
        if (newSize !== textureSize) {
          textureSize = newSize
          initCanvases(textureSize)
          renderToDisplay()
        }
      })
    }
  }

  const delBtn = el.querySelector('#tp-delete')
  if (currentId) {
    delBtn.addEventListener('click', () => {
      if (confirm('¿Eliminar esta textura?')) deleteTexture(currentId)
    })
  }

  populateBrushSelect()
}

function saveTexture() {
  const name = document.getElementById('tp-name')?.value
  if (!name || !name.trim()) {
    alert('El nombre es obligatorio')
    return
  }

  const image = diffuseCanvas.toDataURL('image/png')
  const normalMap = normalCanvas.toDataURL('image/png')

  const data = {
    name: name.trim(),
    width: diffuseCanvas.width,
    height: diffuseCanvas.height,
    format: 'png',
    image,
    normalMap,
  }

  const method = currentId ? 'PUT' : 'POST'
  const url = currentId
    ? `/api/resources/textures/${currentId}`
    : '/api/resources/textures'

  fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
    .then(r => r.json())
    .then(t => {
      currentId = t.id
      loadList()
    })
    .catch(() => alert('Error al guardar'))
}

function deleteTexture(id) {
  fetch(`/api/resources/textures/${id}`, { method: 'DELETE' })
    .then(() => {
      if (currentId === id) {
        currentId = null
        newTexture()
      }
      loadList()
    })
    .catch(() => alert('Error al eliminar'))
}

function escapeHtml(str) {
  if (!str) return ''
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

export function cleanupTexturePainter() {
  diffuseCanvas = null
  normalCanvas = null
  displayCanvas = null
  displayCtx = null
  currentId = null
  isDrawing = false
  brushColor = '#888888'
  brushSize = 16
  tool = 'brush'
  activeLayer = 'diffuse'
  textureSize = 512
  materialList = []
}

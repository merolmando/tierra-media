let currentId = null
let diffuseCanvas = null
let heightCanvas = null
let displayCanvas = null
let displayCtx = null
let isDrawing = false
let brushColor = '#888888'
let brushSize = 4
let tool = 'brush'
let showNormalOverlay = true
let normalCache = null
let normalDirty = true
let textureSize = 64
let materialList = []
let heightStrength = 2
let heightValue = 128

export function renderTexturePainter() {
  const app = document.getElementById('app')
  app.innerHTML = `
    <div class="tool-header">
      <h1>Texture Painter</h1>
      <button id="tp-new" class="btn-primary">+ Nueva</button>
    </div>
    <div class="tool-layout">
      <div id="tp-list" class="tool-panel"></div>
      <div id="tp-canvas-container" class="tool-viewport"></div>
      <div id="tp-props" class="tool-props"></div>
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
  fillCanvas(heightCanvas, '#808080')
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

  heightCanvas = document.createElement('canvas')
  heightCanvas.width = size
  heightCanvas.height = size
  const hctx = heightCanvas.getContext('2d')
  hctx.fillStyle = '#808080'
  hctx.fillRect(0, 0, size, size)

  setupDisplay()
}

function setupDisplay() {
  const container = document.getElementById('tp-canvas-container')
  container.innerHTML = ''
  displayCanvas = document.createElement('canvas')
  displayCanvas.style.cursor = 'crosshair'
  displayCanvas.style.imageRendering = 'pixelated'
  displayCanvas.style.display = 'block'
  container.appendChild(displayCanvas)
  displayCtx = displayCanvas.getContext('2d')

  displayCanvas.addEventListener('mousedown', onMouseDown)
  displayCanvas.addEventListener('mousemove', onMouseMove)
  displayCanvas.addEventListener('mouseup', onMouseUp)
  displayCanvas.addEventListener('mouseleave', onMouseUp)

  const ro = new ResizeObserver(() => resizeDisplay())
  ro.observe(container)
  displayCanvas._resizeObserver = ro
}

function resizeDisplay() {
  if (!displayCanvas || !diffuseCanvas) return
  const container = document.getElementById('tp-canvas-container')
  if (!container) return
  const cw = container.clientWidth
  const ch = container.clientHeight
  if (cw === 0 || ch === 0) return

  const aspect = diffuseCanvas.width / diffuseCanvas.height

  let dw, dh
  if (cw / ch > aspect) {
    dh = ch
    dw = ch * aspect
  } else {
    dw = cw
    dh = cw / aspect
  }

  dw = Math.floor(dw)
  dh = Math.floor(dh)
  displayCanvas.style.width = dw + 'px'
  displayCanvas.style.height = dh + 'px'
}

function renderToDisplay() {
  if (!displayCanvas || !diffuseCanvas) return
  displayCanvas.width = diffuseCanvas.width
  displayCanvas.height = diffuseCanvas.height
  displayCtx.drawImage(diffuseCanvas, 0, 0)

  if (showNormalOverlay) {
    if (normalDirty) {
      normalCache = heightToNormal(heightCanvas, heightStrength)
      normalDirty = false
    }
    displayCtx.globalAlpha = 0.35
    displayCtx.drawImage(normalCache, 0, 0)
    displayCtx.globalAlpha = 1
  }

  resizeDisplay()
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
  const isHeight = tool === 'height'
  const src = isHeight ? heightCanvas : diffuseCanvas
  const ctx = src.getContext('2d')
  const pos = getCanvasCoords(e)
  const size = brushSize

  const paintColor = isHeight
    ? `rgb(${heightValue},${heightValue},${heightValue})`
    : brushColor

  ctx.save()

  if (tool === 'fill') {
    ctx.fillStyle = paintColor
    ctx.fillRect(0, 0, src.width, src.height)
  } else if (tool === 'eraser') {
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, size / 2, 0, Math.PI * 2)
    ctx.clip()
    ctx.clearRect(0, 0, src.width, src.height)
  } else {
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, size / 2, 0, Math.PI * 2)
    ctx.fillStyle = paintColor
    ctx.fill()
  }

  ctx.restore()
  if (isHeight) normalDirty = true
  renderToDisplay()
}

function heightToNormal(heightCanvas, strength) {
  const hCtx = heightCanvas.getContext('2d')
  const hData = hCtx.getImageData(0, 0, heightCanvas.width, heightCanvas.height)
  const w = heightCanvas.width
  const h = heightCanvas.height

  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const oCtx = out.getContext('2d')
  const oData = oCtx.createImageData(w, h)

  function getPixel(data, x, y) {
    x = Math.max(0, Math.min(w - 1, x))
    y = Math.max(0, Math.min(h - 1, y))
    return data[(y * w + x) * 4] / 255
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const left = getPixel(hData.data, x - 1, y)
      const right = getPixel(hData.data, x + 1, y)
      const up = getPixel(hData.data, x, y - 1)
      const down = getPixel(hData.data, x, y + 1)

      const dx = (right - left) * strength
      const dy = (down - up) * strength

      const len = Math.sqrt(dx * dx + dy * dy + 1)
      const nx = -dx / len
      const ny = -dy / len
      const nz = 1 / len

      const idx = (y * w + x) * 4
      oData.data[idx]     = Math.round((nx * 0.5 + 0.5) * 255)
      oData.data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255)
      oData.data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255)
      oData.data[idx + 3] = 255
    }
  }

  oCtx.putImageData(oData, 0, 0)
  return out
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
      textureSize = t.width || 64
      const size = textureSize

      diffuseCanvas = document.createElement('canvas')
      diffuseCanvas.width = size
      diffuseCanvas.height = size
      heightCanvas = document.createElement('canvas')
      heightCanvas.width = size
      heightCanvas.height = size

      setupDisplay()

      loadImageToCanvas(t.image, diffuseCanvas, () => {
        if (t.normalMap) {
          normalToHeight(t.normalMap, () => {
            renderToDisplay()
            renderProps(t)
          })
        } else {
          fillCanvas(heightCanvas, '#808080')
          renderToDisplay()
          renderProps(t)
        }
      })
    })
    .catch(() => {})
}

function normalToHeight(normalDataUrl, cb) {
  const img = new Image()
  img.onload = () => {
    const temp = document.createElement('canvas')
    temp.width = img.width
    temp.height = img.height
    const ctx = temp.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const data = ctx.getImageData(0, 0, temp.width, temp.height)

    const hCtx = heightCanvas.getContext('2d')
    const hData = hCtx.createImageData(heightCanvas.width, heightCanvas.height)
    for (let i = 0; i < hData.data.length; i += 4) {
      const r = data.data[i] / 255
      const g = data.data[i + 1] / 255
      const height = 1 - (r + g) / 2
      const v = Math.round(Math.max(0, Math.min(1, height)) * 255)
      hData.data[i] = v
      hData.data[i + 1] = v
      hData.data[i + 2] = v
      hData.data[i + 3] = 255
    }
    hCtx.putImageData(hData, 0, 0)
    if (cb) cb()
  }
  img.src = normalDataUrl
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
    <select id="tp-size" style="width:100%;margin-bottom:12px;background:#222;color:#ddd;border:1px solid #444;border-radius:6px;padding:5px 8px;font-size:13px">
      ${[64, 128, 256].map(s => `<option value="${s}" ${(t.size || 64) === s ? 'selected' : ''}>${s}×${s}</option>`).join('')}
    </select>
    <button id="tp-apply-size" class="btn-primary" style="width:100%;margin-bottom:16px">Aplicar tamaño</button>
    ` : ''}

    <hr style="border:none;border-top:1px solid #2a2a2a;margin:12px 0">

    <div style="font-size:12px;font-weight:600;color:#44aa88;margin-bottom:8px">HERRAMIENTAS</div>

    <div style="display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap">
      <button class="tp-tool-btn ${tool === 'brush' ? 'tp-tool-active' : ''}" data-tool="brush" style="flex:1;min-width:40px;padding:6px;border-radius:4px;border:1px solid #444;background:#222;color:#ddd;cursor:pointer;font-size:12px">Pincel</button>
      <button class="tp-tool-btn ${tool === 'fill' ? 'tp-tool-active' : ''}" data-tool="fill" style="flex:1;min-width:40px;padding:6px;border-radius:4px;border:1px solid #444;background:#222;color:#ddd;cursor:pointer;font-size:12px">Relleno</button>
      <button class="tp-tool-btn ${tool === 'eraser' ? 'tp-tool-active' : ''}" data-tool="eraser" style="flex:1;min-width:40px;padding:6px;border-radius:4px;border:1px solid #444;background:#222;color:#ddd;cursor:pointer;font-size:12px">Goma</button>
      <button class="tp-tool-btn ${tool === 'height' ? 'tp-tool-active' : ''}" data-tool="height" style="flex:1;min-width:40px;padding:6px;border-radius:4px;border:1px solid #444;background:#222;color:#ddd;cursor:pointer;font-size:12px">Altura</button>
    </div>

    <label style="display:block;font-size:12px;color:#888;margin-bottom:4px">Tamaño de pincel <span id="tp-brush-size-label" style="color:#666">${brushSize}px</span></label>
    <input id="tp-brush-size" type="range" min="1" max="32" step="1" value="${brushSize}" style="width:100%;margin-bottom:12px;accent-color:#44aa88;height:4px">

    <label style="display:block;font-size:12px;color:#888;margin-bottom:4px">Pincel (material)</label>
    <select id="tp-brush-mat" style="width:100%;margin-bottom:12px;background:#222;color:#ddd;border:1px solid #444;border-radius:6px;padding:5px 8px;font-size:13px">
      <option value="">— Seleccionar material —</option>
    </select>

    <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#888;margin-bottom:12px;cursor:pointer">
      <input id="tp-overlay" type="checkbox" ${showNormalOverlay ? 'checked' : ''} style="accent-color:#44aa88">
      Ver normal map
    </label>

    <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#888;margin-bottom:4px;cursor:pointer">
      <span>Intensidad <span id="tp-height-str-label" style="color:#666">${heightStrength.toFixed(1)}</span></span>
    </label>
    <input id="tp-height-str" type="range" min="0.5" max="10" step="0.5" value="${heightStrength}" style="width:100%;margin-bottom:6px;accent-color:#44aa88;height:4px">

    <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#888;margin-bottom:4px;cursor:pointer">
      <span>Valor de altura <span id="tp-height-val-label" style="color:#666">${heightValue}</span></span>
    </label>
    <input id="tp-height-val" type="range" min="0" max="255" step="1" value="${heightValue}" style="width:100%;margin-bottom:16px;accent-color:#44aa88;height:4px">

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
  el.querySelector('#tp-overlay').addEventListener('change', () => {
    showNormalOverlay = document.getElementById('tp-overlay').checked
    renderToDisplay()
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
  el.querySelector('#tp-height-str').addEventListener('input', () => {
    heightStrength = parseFloat(el.querySelector('#tp-height-str').value)
    document.getElementById('tp-height-str-label').textContent = heightStrength.toFixed(1)
    normalDirty = true
    if (showNormalOverlay) renderToDisplay()
  })
  el.querySelector('#tp-height-val').addEventListener('input', () => {
    heightValue = parseInt(el.querySelector('#tp-height-val').value)
    document.getElementById('tp-height-val-label').textContent = heightValue
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
          fillCanvas(diffuseCanvas, '#888888')
          fillCanvas(heightCanvas, '#808080')
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
  const normalCanvas = heightToNormal(heightCanvas, heightStrength)
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
  if (displayCanvas && displayCanvas._resizeObserver) {
    displayCanvas._resizeObserver.disconnect()
  }
  diffuseCanvas = null
  heightCanvas = null
  displayCanvas = null
  displayCtx = null
  currentId = null
  isDrawing = false
  brushColor = '#888888'
  brushSize = 4
  tool = 'brush'
  textureSize = 64
  materialList = []
  heightStrength = 2
  heightValue = 128
}

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

let currentId = null
let worldData = null
let layerStack = [] // ['macro', 'zona', 'mapa']
let selMacro = null
let selZona = null
let selMapa = null
let heightCache = {}
let biomeCache = {}
let previewCanvas = null
let previewCtx = null
let show3d = false
let scene3d = null
let camera3d = null
let renderer3d = null
let controls3d = null
let animFrame = null
let container3d = null

const DEFAULT_REGLAS = {
  macro: { noise: 'perlin', scale: 100, octaves: 4, amplitude: 1, persistence: 0.5 },
  zona: { noise: 'perlin', scale: 40, octaves: 3, amplitude: 1, persistence: 0.5, tempBase: 0.5, humedadBase: 0.5 },
  mapa: { noise: 'perlin', scale: 15, octaves: 3, amplitude: 10, persistence: 0.5, mar: 0 },
}

const DEFAULT_TILES = { macro: [8, 8], zona: [4, 4], mapa: [2, 2] }
const DEFAULT_ALTURA = { abajo: 3, arriba: 3 }

// --- Perlin noise ---
class Perlin {
  constructor(seed) {
    const p = new Uint8Array(512)
    const perm = new Uint8Array(256)
    for (let i = 0; i < 256; i++) perm[i] = i
    let s = seed || Math.random() * 2147483647
    for (let i = 255; i > 0; i--) {
      s = (s * 16807 + 0) % 2147483647
      const j = s % (i + 1); [perm[i], perm[j]] = [perm[j], perm[i]]
    }
    for (let i = 0; i < 512; i++) p[i] = perm[i & 255]
    this.p = p
  }
  fade(t) { return t * t * t * (t * (t * 6 - 15) + 10) }
  lerp(a, b, t) { return a + t * (b - a) }
  grad(hash, x, y) {
    const h = hash & 3
    const u = h < 2 ? x : y
    const v = h < 2 ? y : x
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v)
  }
  noise2D(x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255
    const xf = x - Math.floor(x), yf = y - Math.floor(y)
    const u = this.fade(xf), v = this.fade(yf)
    const aa = this.p[this.p[X] + Y], ab = this.p[this.p[X] + Y + 1]
    const ba = this.p[this.p[X + 1] + Y], bb = this.p[this.p[X + 1] + Y + 1]
    return this.lerp(
      this.lerp(this.grad(aa, xf, yf), this.grad(ba, xf - 1, yf), u),
      this.lerp(this.grad(ab, xf, yf - 1), this.grad(bb, xf - 1, yf - 1), u), v
    )
  }
  fbm(x, y, octaves, scale, amplitude, persistence) {
    let value = 0, amp = amplitude, freq = 1 / scale
    for (let i = 0; i < octaves; i++) {
      value += this.noise2D(x * freq, y * freq) * amp
      amp *= persistence
      freq *= 2
    }
    return value
  }
}

function uuid() { return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 11) }

function escapeHtml(s) { if (!s) return ''; return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

// --- World generation ---
function generateMacro(world, reglas) {
  const noise = new Perlin(world.seed)
  const [cols, rows] = world.tiles.macro
  const heights = []
  for (let y = 0; y < rows; y++) {
    heights[y] = []
    for (let x = 0; x < cols; x++) {
      heights[y][x] = noise.fbm(x, y, reglas.octaves, reglas.scale, reglas.amplitude, reglas.persistence)
    }
  }
  return heights
}

function generateZona(world, macroX, macroY, reglas) {
  const noise = new Perlin(world.seed + macroX * 1000 + macroY)
  const [cols, rows] = world.tiles.zona
  const heights = [], temps = [], hums = []
  for (let y = 0; y < rows; y++) {
    heights[y] = []; temps[y] = []; hums[y] = []
    for (let x = 0; x < cols; x++) {
      const gx = macroX * cols + x, gy = macroY * rows + y
      heights[y][x] = noise.fbm(gx, gy, reglas.octaves, reglas.scale, reglas.amplitude, reglas.persistence)
      temps[y][x] = noise.fbm(gx + 500, gy + 500, 2, 50, 1, 0.5) * 0.5 + reglas.tempBase
      hums[y][x] = noise.fbm(gx + 1000, gy + 1000, 2, 50, 1, 0.5) * 0.5 + reglas.humedadBase
    }
  }
  return { heights, temps, hums }
}

function generateMapa(world, macroX, macroY, zonaX, zonaY, reglas) {
  const noise = new Perlin(world.seed + macroX * 10000 + macroY * 1000 + zonaX * 100 + zonaY)
  const [cols, rows] = world.tiles.mapa
  const heights = []
  for (let y = 0; y < rows; y++) {
    heights[y] = []
    for (let x = 0; x < cols; x++) {
      const gx = macroX * world.tiles.zona[0] + zonaX * cols + x
      const gy = macroY * world.tiles.zona[1] + zonaY * rows + y
      const h = noise.fbm(gx, gy, reglas.octaves, reglas.scale, reglas.amplitude, reglas.persistence)
      heights[y][x] = Math.round(h + reglas.mar)
    }
  }
  return heights
}

function generateBlocks(world, macroX, macroY, zonaX, zonaY, mapaX, mapaY, reglas) {
  const mapHeights = generateMapa(world, macroX, macroY, zonaX, zonaY, reglas)
  const blk = world.tiles.mapaBlk || 8
  const [abajo, arriba] = [world.altura.abajo, world.altura.arriba]
  const totalH = (abajo + arriba) * 16
  const blocks = []
  for (let z = 0; z < blk; z++) {
    for (let x = 0; x < blk; x++) {
      const h = mapHeights[z]?.[x] ?? 0
      const surfY = abajo * 16 + h
      for (let y = 0; y < totalH; y++) {
        if (y <= surfY) blocks.push({ x, y, z })
      }
    }
  }
  return blocks
}

// --- Rendering ---
function heatColor(v) {
  const t = Math.max(0, Math.min(1, (v + 1) / 2))
  const r = Math.round(Math.min(255, t * 510))
  const g = Math.round(Math.min(255, 510 - t * 510))
  return `rgb(${r},${g},80)`
}

function biomeColor(temp, hum) {
  if (hum < 0.3) return '#c8b060'
  if (temp < 0.3) return '#608080'
  if (temp > 0.7 && hum > 0.6) return '#307030'
  if (temp > 0.6) return '#60a030'
  return '#80b040'
}

function render2D() {
  if (!previewCtx || !worldData) return
  const ctx = previewCtx
  const canvas = previewCanvas
  const container = canvas.parentElement
  const w = container.clientWidth - 4, h = container.clientHeight - 4
  canvas.width = w; canvas.height = h

  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, w, h)

  const reglas = worldData.reglas
  const activeLayer = layerStack.length > 0 ? layerStack[layerStack.length - 1] : 'macro'

  if (activeLayer === 'macro') {
    const hData = generateMacro(worldData, reglas.macro)
    const [cols, rows] = worldData.tiles.macro
    const cw = w / cols, ch = h / rows
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        ctx.fillStyle = heatColor(hData[y][x])
        ctx.fillRect(x * cw, y * ch, cw, ch)
        if (selMacro && selMacro[0] === x && selMacro[1] === y) {
          ctx.strokeStyle = '#44ccff'; ctx.lineWidth = 3; ctx.strokeRect(x * cw, y * ch, cw, ch)
        }
      }
    }
  } else if (activeLayer === 'zona' && selMacro) {
    const zData = generateZona(worldData, selMacro[0], selMacro[1], reglas.zona)
    const [cols, rows] = worldData.tiles.zona
    const cw = w / cols, ch = h / rows
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        ctx.fillStyle = biomeColor(zData.temps[y][x], zData.hums[y][x])
        ctx.fillRect(x * cw, y * ch, cw, ch)
        if (selZona && selZona[0] === x && selZona[1] === y) {
          ctx.strokeStyle = '#44ccff'; ctx.lineWidth = 3; ctx.strokeRect(x * cw, y * ch, cw, ch)
        }
      }
    }
  } else if (activeLayer === 'mapa' && selMacro && selZona) {
    const mData = generateMapa(worldData, selMacro[0], selMacro[1], selZona[0], selZona[1], reglas.mapa)
    const [cols, rows] = worldData.tiles.mapa
    const cw = w / cols, ch = h / rows
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        ctx.fillStyle = heatColor(mData[y][x] / 10)
        ctx.fillRect(x * cw, y * ch, cw, ch)
        if (selMapa && selMapa[0] === x && selMapa[1] === y) {
          ctx.strokeStyle = '#44ccff'; ctx.lineWidth = 3; ctx.strokeRect(x * cw, y * ch, cw, ch)
        }
      }
    }
  }
}

function drawMiniMap(ctx, w, h) {
  if (!worldData) return
  const reglas = worldData.reglas
  const [mc, mr] = worldData.tiles.macro
  const [zc, zr] = worldData.tiles.zona
  const cw = w / (mc * zc), ch = h / (mr * zr)
  if (cw < 2 || ch < 2) return
  for (let my = 0; my < mr; my++) {
    for (let mx = 0; mx < mc; mx++) {
      const zData = generateZona(worldData, mx, my, reglas.zona)
      for (let zy = 0; zy < zr; zy++) {
        for (let zx = 0; zx < zc; zx++) {
          const t = zData.temps[zy]?.[zx] ?? 0.5
          const h = zData.hums[zy]?.[zx] ?? 0.5
          ctx.fillStyle = biomeColor(t, h)
          ctx.fillRect((mx * zc + zx) * cw, (my * zr + zy) * ch, Math.ceil(cw), Math.ceil(ch))
        }
      }
    }
  }
}

function init3D(container) {
  if (renderer3d) return
  container3d = container
  const w = container.clientWidth, h = container.clientHeight
  scene3d = new THREE.Scene()
  scene3d.background = new THREE.Color(0x1a1a1a)
  camera3d = new THREE.PerspectiveCamera(50, w / h, 0.1, 200)
  camera3d.position.set(15, 12, 15)
  renderer3d = new THREE.WebGLRenderer({ antialias: true })
  renderer3d.setSize(w, h)
  container.appendChild(renderer3d.domElement)
  controls3d = new OrbitControls(camera3d, renderer3d.domElement)
  controls3d.target.set(4, 0, 4)
  controls3d.enableDamping = true

  const ambient = new THREE.AmbientLight(0xffffff, 0.4)
  scene3d.add(ambient)
  const dir = new THREE.DirectionalLight(0xffffff, 0.8)
  dir.position.set(10, 20, 10)
  scene3d.add(dir)

  const grid = new THREE.GridHelper(12, 12, 0x444444, 0x333333)
  grid.position.set(4, -0.5, 4)
  scene3d.add(grid)

  animate3D()
}

function animate3D() {
  animFrame = requestAnimationFrame(animate3D)
  if (controls3d) controls3d.update()
  if (renderer3d && scene3d && camera3d) renderer3d.render(scene3d, camera3d)
}

function showMap3D(macroX, macroY, zonaX, zonaY, mapaX, mapaY) {
  if (!scene3d) return
  while (scene3d.children.length > 3) scene3d.remove(scene3d.children[3])
  const reglas = worldData.reglas
  const blk = worldData.tiles.mapaBlk || 8
  const blocks = generateBlocks(worldData, macroX, macroY, zonaX, zonaY, mapaX, mapaY, reglas)
  const geom = new THREE.BoxGeometry(0.9, 0.9, 0.9)
  const mat = new THREE.MeshStandardMaterial({ color: 0xcccccc })
  const merged = new THREE.InstancedMesh(geom, mat, Math.min(blocks.length, 10000))
  const dummy = new THREE.Object3D()
  let idx = 0
  for (const b of blocks) {
    if (idx >= 10000) break
    dummy.position.set(b.x, b.y, b.z)
    dummy.updateMatrix()
    merged.setMatrixAt(idx, dummy.matrix)
    idx++
  }
  merged.count = idx
  merged.instanceMatrix.needsUpdate = true
  scene3d.add(merged)
  controls3d.target.set(blk / 2, 0, blk / 2)
}

function toggle3D() {
  show3d = !show3d
  const vp = document.getElementById('wg-viewport')
  const canvas3d = document.getElementById('wg-canvas3d')
  if (show3d) {
    previewCanvas.style.display = 'none'
    canvas3d.style.display = 'block'
    init3D(canvas3d)
    if (selMacro && selZona && selMapa) {
      showMap3D(selMacro[0], selMacro[1], selZona[0], selZona[1], selMapa[0], selMapa[1])
    }
    setTimeout(() => { if (renderer3d) { const w = canvas3d.clientWidth, h = canvas3d.clientHeight; renderer3d.setSize(w, h); camera3d.aspect = w / h; camera3d.updateProjectionMatrix() } }, 50)
  } else {
    previewCanvas.style.display = 'block'
    canvas3d.style.display = 'none'
    if (renderer3d) { renderer3d.domElement.remove(); renderer3d.dispose(); renderer3d = null; scene3d = null; camera3d = null; controls3d = null; container3d = null }
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null }
    render2D()
  }
}

function onCanvasClick(e) {
  if (!worldData) return
  const rect = previewCanvas.getBoundingClientRect()
  const cx = e.clientX - rect.left, cy = e.clientY - rect.top
  const w = previewCanvas.width, h = previewCanvas.height
  const activeLayer = layerStack.length > 0 ? layerStack[layerStack.length - 1] : 'macro'

  if (activeLayer === 'macro') {
    const [cols, rows] = worldData.tiles.macro
    const cw = w / cols, ch = h / rows
    const x = Math.floor(cx / cw), y = Math.floor(cy / ch)
    if (x >= 0 && x < cols && y >= 0 && y < rows) {
      selMacro = [x, y]; selZona = null; selMapa = null
      layerStack.push('zona')
      render2D(); renderLayerNav()
    }
  } else if (activeLayer === 'zona' && selMacro) {
    const [cols, rows] = worldData.tiles.zona
    const cw = w / cols, ch = h / rows
    const x = Math.floor(cx / cw), y = Math.floor(cy / ch)
    if (x >= 0 && x < cols && y >= 0 && y < rows) {
      selZona = [x, y]; selMapa = null
      layerStack.push('mapa')
      render2D(); renderLayerNav()
    }
  } else if (activeLayer === 'mapa' && selMacro && selZona) {
    const [cols, rows] = worldData.tiles.mapa
    const cw = w / cols, ch = h / rows
    const x = Math.floor(cx / cw), y = Math.floor(cy / ch)
    if (x >= 0 && x < cols && y >= 0 && y < rows) {
      selMapa = [x, y]
      if (show3d) showMap3D(selMacro[0], selMacro[1], selZona[0], selZona[1], selMapa[0], selMapa[1])
      render2D(); renderLayerNav()
    }
  }
}

function renderLayerNav() {
  const el = document.getElementById('wg-layers')
  if (!el) return
  const parts = []
  parts.push(`<a href="#" data-layer="" style="color:#44aa88;text-decoration:none">Macro ${worldData?.tiles?.macro?.join('×') || ''}</a>`)
  if (selMacro) parts.push(` > <a href="#" data-layer="zona" style="color:#44aa88;text-decoration:none">Zona ${selMacro[0]},${selMacro[1]}</a>`)
  if (selZona) parts.push(` > <a href="#" data-layer="mapa" style="color:#44aa88;text-decoration:none">Mapa ${selZona[0]},${selZona[1]}</a>`)
  if (selMapa) parts.push(` > <span style="color:#aaa">Tile ${selMapa[0]},${selMapa[1]}</span>`)
  el.innerHTML = parts.join('')
  el.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault()
      const l = a.dataset.layer
      if (l === '') { layerStack = ['macro']; selMacro = null; selZona = null; selMapa = null }
      else if (l === 'zona') { layerStack = ['macro', 'zona']; selZona = null; selMapa = null }
      else if (l === 'mapa') { layerStack = ['macro', 'zona', 'mapa']; selMapa = null }
      render2D(); renderLayerNav()
    })
  })
}

function renderReglas() {
  const el = document.getElementById('wg-reglas')
  if (!el || !worldData) return
  const activeLayer = layerStack.length > 0 ? layerStack[layerStack.length - 1] : 'macro'
  const r = worldData.reglas[activeLayer] || {}

  const fields = activeLayer === 'macro' ? `
    <label>Tipo ruido</label>
    <select id="wg-noise"><option value="perlin"${r.noise === 'perlin' ? ' selected' : ''}>Perlin</option></select>
    <label>Scale</label><input id="wg-scale" type="number" step="1" value="${r.scale || 100}" style="width:100%">
    <label>Octaves</label><input id="wg-octaves" type="number" step="1" min="1" max="10" value="${r.octaves || 4}" style="width:100%">
    <label>Amplitud</label><input id="wg-amp" type="number" step="0.1" value="${r.amplitude || 1}" style="width:100%">
    <label>Persistencia</label><input id="wg-persist" type="number" step="0.05" min="0" max="1" value="${r.persistence || 0.5}" style="width:100%">
  ` : activeLayer === 'zona' ? `
    <label>Tipo ruido</label>
    <select id="wg-noise"><option value="perlin">Perlin</option></select>
    <label>Scale</label><input id="wg-scale" type="number" step="1" value="${r.scale || 40}" style="width:100%">
    <label>Octaves</label><input id="wg-octaves" type="number" step="1" min="1" max="10" value="${r.octaves || 3}" style="width:100%">
    <label>Amplitud</label><input id="wg-amp" type="number" step="0.1" value="${r.amplitude || 1}" style="width:100%">
    <label>Persistencia</label><input id="wg-persist" type="number" step="0.05" min="0" max="1" value="${r.persistence || 0.5}" style="width:100%">
    <label>Temp. base</label><input id="wg-temp" type="number" step="0.05" min="0" max="1" value="${r.tempBase ?? 0.5}" style="width:100%">
    <label>Humedad base</label><input id="wg-hum" type="number" step="0.05" min="0" max="1" value="${r.humedadBase ?? 0.5}" style="width:100%">
  ` : `
    <label>Tipo ruido</label>
    <select id="wg-noise"><option value="perlin">Perlin</option></select>
    <label>Scale</label><input id="wg-scale" type="number" step="1" value="${r.scale || 15}" style="width:100%">
    <label>Octaves</label><input id="wg-octaves" type="number" step="1" min="1" max="10" value="${r.octaves || 3}" style="width:100%">
    <label>Amplitud</label><input id="wg-amp" type="number" step="0.1" value="${r.amplitude || 10}" style="width:100%">
    <label>Persistencia</label><input id="wg-persist" type="number" step="0.05" min="0" max="1" value="${r.persistence || 0.5}" style="width:100%">
    <label>Nivel del mar</label><input id="wg-mar" type="number" step="1" value="${r.mar ?? 0}" style="width:100%">
  `

  el.innerHTML = `
    <div class="tool-section-title">REGLAS — ${activeLayer.toUpperCase()}</div>
    ${fields}
    <hr>
    <button id="wg-generate" class="btn-primary" style="width:100%">Generar</button>
  `

  const saveRegla = () => {
    const r2 = worldData.reglas[activeLayer]
    const g = id => document.getElementById(id)
    if (g('wg-scale')) r2.scale = parseFloat(g('wg-scale').value) || 1
    if (g('wg-octaves')) r2.octaves = parseInt(g('wg-octaves').value) || 1
    if (g('wg-amp')) r2.amplitude = parseFloat(g('wg-amp').value) || 0.1
    if (g('wg-persist')) r2.persistence = parseFloat(g('wg-persist').value) || 0.5
    if (g('wg-temp')) r2.tempBase = parseFloat(g('wg-temp').value) || 0.5
    if (g('wg-hum')) r2.humedadBase = parseFloat(g('wg-hum').value) || 0.5
    if (g('wg-mar')) r2.mar = parseFloat(g('wg-mar').value) || 0
  }

  el.querySelectorAll('input, select').forEach(inp => inp.addEventListener('input', saveRegla))
  document.getElementById('wg-generate')?.addEventListener('click', () => {
    saveRegla()
    render2D()
    if (show3d && selMacro && selZona && selMapa) showMap3D(selMacro[0], selMacro[1], selZona[0], selZona[1], selMapa[0], selMapa[1])
  })
}

function newWorld() {
  currentId = null
  worldData = {
    id: uuid(),
    name: '',
    seed: Math.floor(Math.random() * 2147483647),
    tiles: { ...DEFAULT_TILES, macro: [...DEFAULT_TILES.macro], zona: [...DEFAULT_TILES.zona], mapa: [...DEFAULT_TILES.mapa], mapaBlk: 8 },
    altura: { ...DEFAULT_ALTURA },
    reglas: { macro: { ...DEFAULT_REGLAS.macro }, zona: { ...DEFAULT_REGLAS.zona }, mapa: { ...DEFAULT_REGLAS.mapa } },
    deltas: {},
    estructuras: [],
  }
  layerStack = ['macro']; selMacro = null; selZona = null; selMapa = null
  document.getElementById('wg-name').value = ''
  render2D(); renderLayerNav(); renderReglas()
}

function renderWorldList() {
  const el = document.getElementById('wg-list')
  if (!el) return
  fetch('/api/resources/worlds').then(r => r.json()).then(list => {
    if (!list.length) { el.innerHTML = '<p style="color:#666;font-size:12px;padding:4px">Sin mundos.</p>'; return }
    el.innerHTML = list.map(t => `<div class="wg-list-item" data-id="${t.id}" style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:6px;cursor:pointer"
         onmouseenter="this.style.background='#2a2a2a'" onmouseleave="this.style.background='transparent'">
      <span style="font-size:13px;flex:1">${escapeHtml(t.name)}</span>
      <button class="btn-delete" data-id="${t.id}" style="background:none;border:none;color:#cc4444;cursor:pointer;font-size:14px;padding:0 4px" title="Eliminar">×</button>
    </div>`).join('')
    el.querySelectorAll('.wg-list-item').forEach(item => {
      item.addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') loadWorld(item.dataset.id) })
    })
    el.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); if (confirm('¿Eliminar mundo?')) deleteWorld(btn.dataset.id) })
    })
  }).catch(() => { el.innerHTML = '<p style="color:#666;font-size:12px">Error.</p>' })
}

function loadWorld(id) {
  fetch(`/api/resources/worlds/${id}`).then(r => r.json()).then(data => {
    currentId = data.id; worldData = data
    layerStack = ['macro']; selMacro = null; selZona = null; selMapa = null
    document.getElementById('wg-name').value = data.name || ''
    renderWorldList(); render2D(); renderLayerNav(); renderReglas()
  }).catch(() => alert('Error al cargar mundo'))
}

function deleteWorld(id) {
  fetch(`/api/resources/worlds/${id}`, { method: 'DELETE' }).then(() => {
    if (currentId === id) newWorld()
    renderWorldList()
  }).catch(() => alert('Error al eliminar'))
}

function saveWorld() {
  const name = document.getElementById('wg-name').value
  if (!name || !name.trim()) { alert('El nombre es obligatorio'); return }
  worldData.name = name.trim()
  const method = currentId ? 'PUT' : 'POST'
  const url = currentId ? `/api/resources/worlds/${currentId}` : '/api/resources/worlds'
  fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(worldData) })
    .then(r => r.json()).then(saved => { currentId = saved.id; renderWorldList() })
    .catch(() => alert('Error al guardar'))
}

export function renderWorldGenerator() {
  const app = document.getElementById('app')
  app.innerHTML = `
    <div class="tool-header">
      <h1>World Generator</h1>
      <div id="wg-layers" style="font-size:13px;color:#888"></div>
    </div>
    <div class="tool-layout" style="grid-template-columns:200px 1fr 240px">
      <div class="tool-panel">
        <div style="display:flex;gap:4px;margin-bottom:8px">
          <input id="wg-name" type="text" placeholder="Nombre del mundo" style="flex:1;background:#222;color:#ddd;border:1px solid #444;border-radius:6px;padding:5px 8px;font-size:13px">
          <button id="wg-new" style="padding:5px 10px;border-radius:4px;border:1px solid #444;background:#222;color:#ddd;cursor:pointer;font-size:13px">+</button>
        </div>
        <button id="wg-save" class="btn-primary" style="width:100%;margin-bottom:8px">Guardar</button>
        <div id="wg-list" style="margin-bottom:8px"></div>
        <hr style="border:none;border-top:1px solid #2a2a2a;margin:12px 0">
        <div style="font-size:12px;font-weight:600;color:#44aa88;margin-bottom:6px">CONFIG</div>
        <label>Seed</label>
        <input id="wg-seed" type="number" step="1" style="width:100%">
        <label>Tiles Macro</label>
        <div style="display:flex;gap:4px"><input id="wg-mc" type="number" step="1" min="1" value="8" style="flex:1"><input id="wg-mr" type="number" step="1" min="1" value="8" style="flex:1"></div>
        <label>Tiles Zona</label>
        <div style="display:flex;gap:4px"><input id="wg-zc" type="number" step="1" min="1" value="4" style="flex:1"><input id="wg-zr" type="number" step="1" min="1" value="4" style="flex:1"></div>
        <label>Tiles Mapa</label>
        <div style="display:flex;gap:4px"><input id="wg-mpc" type="number" step="1" min="1" value="2" style="flex:1"><input id="wg-mpr" type="number" step="1" min="1" value="2" style="flex:1"></div>
        <label>Altura abajo (chunks)</label>
        <input id="wg-abajo" type="number" step="1" min="0" value="3" style="width:100%">
        <label>Altura arriba (chunks)</label>
        <input id="wg-arriba" type="number" step="1" min="0" value="3" style="width:100%">
      </div>
      <div class="tool-viewport" id="wg-viewport" style="overflow:hidden;position:relative">
        <canvas id="wg-canvas" style="display:block;cursor:pointer"></canvas>
        <div id="wg-canvas3d" style="display:none;width:100%;height:100%"></div>
        <div style="position:absolute;top:8px;right:8px;z-index:10">
          <button id="wg-toggle3d" style="padding:4px 10px;border-radius:4px;border:1px solid #444;background:rgba(0,0,0,0.7);color:#ddd;cursor:pointer;font-size:11px">3D</button>
        </div>
      </div>
      <div class="tool-props" id="wg-reglas" style="overflow-y:auto;font-size:12px">
        <p style="color:#666;padding:8px">Creá o cargá un mundo para empezar.</p>
      </div>
    </div>
  `

  previewCanvas = document.getElementById('wg-canvas')
  previewCtx = previewCanvas.getContext('2d')

  previewCanvas.addEventListener('click', onCanvasClick)

  document.getElementById('wg-save').addEventListener('click', saveWorld)
  document.getElementById('wg-new').addEventListener('click', newWorld)

  document.getElementById('wg-toggle3d').addEventListener('click', toggle3D)

  const configInputs = ['wg-seed', 'wg-mc', 'wg-mr', 'wg-zc', 'wg-zr', 'wg-mpc', 'wg-mpr', 'wg-abajo', 'wg-arriba']
  const applyConfig = () => {
    if (!worldData) return
    worldData.seed = parseInt(document.getElementById('wg-seed').value) || 0
    worldData.tiles.macro = [parseInt(document.getElementById('wg-mc').value) || 8, parseInt(document.getElementById('wg-mr').value) || 8]
    worldData.tiles.zona = [parseInt(document.getElementById('wg-zc').value) || 4, parseInt(document.getElementById('wg-zr').value) || 4]
    worldData.tiles.mapa = [parseInt(document.getElementById('wg-mpc').value) || 2, parseInt(document.getElementById('wg-mpr').value) || 2]
    worldData.altura.abajo = parseInt(document.getElementById('wg-abajo').value) || 3
    worldData.altura.arriba = parseInt(document.getElementById('wg-arriba').value) || 3
  }
  configInputs.forEach(id => document.getElementById(id).addEventListener('input', applyConfig))

  newWorld()
  renderWorldList()

  const updateSeedDisp = () => {
    if (worldData) document.getElementById('wg-seed').value = worldData.seed
  }
  updateSeedDisp()
  const seedObs = setInterval(() => {
    if (worldData) document.getElementById('wg-seed').value = worldData.seed
  }, 100)
  setTimeout(() => clearInterval(seedObs), 500)
}

export function cleanupWorldGenerator() {
  if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null }
  if (renderer3d) { renderer3d.dispose(); renderer3d = null }
  if (controls3d) { controls3d.dispose(); controls3d = null }
  currentId = null; worldData = null; scene3d = null; camera3d = null; container3d = null
  layerStack = ['macro']; selMacro = null; selZona = null; selMapa = null
  previewCanvas = null; previewCtx = null; show3d = false
}

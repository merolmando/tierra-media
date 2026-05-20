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
let touring = false
let fullMapView = false
let fullCanvas = null
let fullZoom = 1
let fullPanX = 0
let fullPanY = 0
let fullDragging = false
let fullDragStartX = 0
let fullDragStartY = 0
let scene3d = null
let camera3d = null
let renderer3d = null
let controls3d = null
let animFrame = null
let container3d = null
let simPlaying = false
let simVelocidad = 1
let ultimoTick = 0
let animSimId = null

const DEFAULT_REGLAS = {
  macro: { distorsionFrecuencia: 0.3, distorsionMagnitud: 20, cotaMar: 0.45, transicionCosta: 0.1, detalleRuido: 30, detalleOctaves: 4, placas: 4, tectFuerza: 0.5, tectElevacion: 0.3, tectSubsidencia: 0.2, vientoEscala: 1, alturaInflTemp: 0.3, humEscala: 0.5, lluviaFactor: 1, distMaxCostas: 5, velocidadDia: 25, estacion: 0, erosionFactor: 0.005, añosErosion: 0 },
  zona: { detalleEscala: 20, detalleOctaves: 3, detalleAmp: 0.3, varTemp: 0.2, varHum: 0.15, eoEolica: 0.3, eoHidrica: 0.3, rangoDetalle: 0.15, floraFactor: 1 },
  mapa: { noise: 'perlin', scale: 15, octaves: 3, amplitude: 10, persistence: 0.5, mar: 0 },
}

const DEFAULT_TILES = { macro: 8, zona: 4, mapa: 8 }
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
function generateMacro(world, reglas, hora, estacion) {
  const noise = new Perlin(world.seed)
  const [cols, rows] = world.tiles.macro

  // --- 1. Altura Base H (raw) ---
  const _H = []
  for (let y = 0; y < rows; y++) {
    _H[y] = []
    for (let x = 0; x < cols; x++) {
      const wFreq = reglas.distorsionFrecuencia ?? 0.3
      const warpX = noise.fbm(x * wFreq, y * wFreq, 3, 1, 1, 0.5)
      const warpY = noise.fbm(x * wFreq + 100, y * wFreq + 100, 3, 1, 1, 0.5)
      const wx = x + warpX * (reglas.distorsionMagnitud ?? 20)
      const wy = y + warpY * (reglas.distorsionMagnitud ?? 20)
      const cont = noise.fbm(wx * 0.05, wy * 0.05, 3, 1, 1, 0.5)
      const sig = 1 / (1 + Math.exp(-(cont - (reglas.cotaMar ?? 0.45)) / (reglas.transicionCosta ?? 0.1)))
      const mask = Math.max(0, Math.min(1, sig))
      const detail = noise.fbm(wx, wy, reglas.detalleOctaves, reglas.detalleRuido, 1, 0.5) * Math.max(0, mask - 0.45) * 4
      _H[y][x] = (mask - 0.5) * 2 + detail
    }
  }

  // --- Tectonic faults ---
  const nPoints = Math.max(2, reglas.placas || 4)
  const faultNoise = new Perlin(world.seed + 777)
  const pts = []
  for (let i = 0; i < nPoints; i++) {
    pts.push({
      x: (faultNoise.noise2D(i * 100.7 + 33.3, 42.7) * 0.5 + 0.5) * (cols - 1),
      y: (faultNoise.noise2D(77.3, i * 100.7 + 33.3) * 0.5 + 0.5) * (rows - 1),
    })
  }
  const edges = []
  const seen = new Set()
  for (let i = 0; i < nPoints; i++) {
    let minD = Infinity, nj = -1
    for (let j = 0; j < nPoints; j++) {
      if (j === i) continue
      const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y
      const d = dx * dx + dy * dy
      if (d < minD) { minD = d; nj = j }
    }
    if (nj < 0) continue
    const key = Math.min(i, nj) + '-' + Math.max(i, nj)
    if (!seen.has(key)) {
      seen.add(key)
      const sign = faultNoise.noise2D(i * 50.7 + nj * 23.3, nj * 50.7 + i * 23.3) > 0 ? 1 : -1
      edges.push({ i, j: nj, sign })
    }
  }
  const faultSegments = []
  for (const e of edges) {
    const a = pts[e.i], b = pts[e.j]
    const angle = Math.atan2(b.y - a.y, b.x - a.x)
    const upAngle = angle + Math.PI / 2
    const strength = 0.3 + Math.abs(faultNoise.noise2D(e.i * 10.7, e.j * 10.7)) * 0.7
    faultSegments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, upAngle, upSide: e.sign, strength })
  }
  const fRadius = 4
  const tectForce = reglas.tectFuerza ?? 0.5
  const tectUp = reglas.tectElevacion ?? 0.3
  const tectDown = reglas.tectSubsidencia ?? 0.2
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let totalUplift = 0
      for (const f of faultSegments) {
        const dx = f.x2 - f.x1, dy = f.y2 - f.y1
        const lenSq = dx * dx + dy * dy || 1
        let t = ((x - f.x1) * dx + (y - f.y1) * dy) / lenSq
        t = Math.max(0, Math.min(1, t))
        const px = f.x1 + t * dx, py = f.y1 + t * dy
        const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2)
        if (dist < fRadius) {
          const cross = (x - f.x1) * dy - (y - f.y1) * dx
          const side = cross > 0 ? 1 : -1
          const falloff = 1 - dist / fRadius
          if (side === f.upSide) {
            totalUplift += tectUp * tectForce * falloff * f.strength
          } else {
            totalUplift -= tectDown * tectForce * falloff * f.strength
          }
        }
      }
      _H[y][x] += totalUplift * 0.3
    }
  }

  // Normalize H to 0.0–1.0
  let _minH = Infinity, _maxH = -Infinity
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (_H[y][x] < _minH) _minH = _H[y][x]
    if (_H[y][x] > _maxH) _maxH = _H[y][x]
  }
  const _range = _maxH - _minH || 1
  const H = []
  for (let y = 0; y < rows; y++) {
    H[y] = []
    for (let x = 0; x < cols; x++) {
      H[y][x] = (_H[y][x] - _minH) / _range
    }
  }
  const minH = 0, maxH = 1
  const midY = (rows - 1) / 2

  // --- 2. Temperatura Latitud TL (modulada por estación) ---
  const est = estacion ?? 0
  const TL = []
  for (let y = 0; y < rows; y++) {
    TL[y] = []
    for (let x = 0; x < cols; x++) {
      const latNorm = Math.abs(y - midY) / midY
      const estFactor = est === 1 ? 0.12 : est === 3 ? -0.12 : est === 0 ? 0.04 : -0.04
      TL[y][x] = Math.max(0, Math.min(1, 1 - latNorm + estFactor * latNorm))
    }
  }

  // --- 3. Temperatura Real TR (modulada por hora del día) ---
  const hr = hora ?? 6
  const horaLocal = []
  for (let x = 0; x < cols; x++) {
    horaLocal[x] = (hr + x * 24 / cols) % 24
  }
  const TR = []
  for (let y = 0; y < rows; y++) {
    TR[y] = []
    for (let x = 0; x < cols; x++) {
      const hNorm = H[y][x]
      const isOcean = H[y][x] < 0.5
      const depthFactor = isOcean ? Math.min(1, Math.abs(H[y][x] - 0.5) / 0.25) * 0.3 : 0
      let temp = TL[y][x] - hNorm * (reglas.alturaInflTemp ?? 0.3) - depthFactor
      const solarAngle = (horaLocal[x] / 24) * Math.PI * 2
      const dayFactor = (Math.cos(solarAngle - Math.PI) + 1) / 2
      const nightCool = (1 - dayFactor) * 0.12 * (isOcean ? 0.3 : 1)
      temp -= nightCool
      TR[y][x] = Math.max(0, Math.min(1, temp))
    }
  }

  // --- 4. Presión P ---
  const P = []
  for (let y = 0; y < rows; y++) {
    P[y] = []
    for (let x = 0; x < cols; x++) {
      P[y][x] = Math.max(0, Math.min(1, 1 - TR[y][x]))
    }
  }

  // --- 5. Viento WU, WV, WS ---
  const WU = [], WV = [], WS = []
  for (let y = 0; y < rows; y++) {
    WU[y] = []; WV[y] = []; WS[y] = []
    for (let x = 0; x < cols; x++) {
      const px0 = x > 0 ? P[y][x - 1] : P[y][x]
      const px1 = x < cols - 1 ? P[y][x + 1] : P[y][x]
      const py0 = y > 0 ? P[y - 1][x] : P[y][x]
      const py1 = y < rows - 1 ? P[y + 1][x] : P[y][x]
      let du = -(px1 - px0) * 0.5 * (reglas.vientoEscala ?? 1)
      let dv = -(py1 - py0) * 0.5 * (reglas.vientoEscala ?? 1)
      const latNorm = (y / rows - 0.5) * 2
      const coriolis = latNorm * 0.3
      WU[y][x] = du - dv * coriolis
      WV[y][x] = dv + du * coriolis
      const hSlope = y > 0 ? Math.abs(H[y][x] - H[y - 1][x]) : 0
      const vSlope = x > 0 ? Math.abs(H[y][x] - H[y][x - 1]) : 0
      WS[y][x] = Math.min(1, Math.sqrt(WU[y][x] ** 2 + WV[y][x] ** 2) * (1 + (hSlope + vSlope) * 2))
    }
  }

  // --- 6. Humedad Hum (wind carries moisture from oceans inland) ---
  const Hum = []
  const maxDist = reglas.distMaxCostas ?? 5
  for (let y = 0; y < rows; y++) {
    Hum[y] = []
    for (let x = 0; x < cols; x++) {
      if (H[y][x] < 0.5) {
        Hum[y][x] = 1.0
      } else {
        const wu = WU[y][x] || 0.001
        const wv = WV[y][x] || 0.001
        const wlen = Math.sqrt(wu * wu + wv * wv)
        let foundOcean = false, dist = maxDist
        for (let ang = -2; ang <= 2; ang++) {
          const a = Math.atan2(wv, wu) + ang * 0.3
          const adx = -Math.cos(a), ady = -Math.sin(a)
          let hit = false
          for (let s = 1; s <= Math.ceil(maxDist); s++) {
            const tx = Math.round(x + adx * s), ty = Math.round(y + ady * s)
            if (tx < 0 || tx >= cols || ty < 0 || ty >= rows) break
            if (H[ty][tx] < 0.5) { hit = true; dist = s; break }
          }
          if (hit) { foundOcean = true; break }
        }
        const humBase = foundOcean ? Math.max(0, 1 - dist / maxDist) : 0
        const hDamp = Math.max(0.1, 1 - H[y][x] * 0.8)
        Hum[y][x] = Math.max(0, Math.min(1, humBase * wlen * hDamp * (reglas.humEscala ?? 0.5) * 2))
      }
    }
  }

  // --- 7. Lluvia R (humidity → precipitation on slopes) ---
  const R = []
  for (let y = 0; y < rows; y++) {
    R[y] = []
    for (let x = 0; x < cols; x++) {
      if (H[y][x] < 0.5) {
        R[y][x] = 0
      } else {
        const hSlope = y > 0 ? Math.abs(H[y][x] - H[y - 1][x]) : 0
        const vSlope = x > 0 ? Math.abs(H[y][x] - H[y][x - 1]) : 0
        const slope = (hSlope + vSlope) * 4
        R[y][x] = Math.max(0, Math.min(1, Hum[y][x] * slope * (reglas.lluviaFactor ?? 1)))
      }
    }
  }

  // Solar angle for skybox (global, based on first column)
  const anguloSol = ((hr) / 24) * Math.PI * 2

  return { H, TL, TR, P, WU, WV, WS, Hum, R, horaLocal, anguloSol, minH, maxH, faultSegments }
}

function sampleGrid(grid, cols, rows, wx, wy) {
  const x = Math.max(0, Math.min(cols - 1, wx))
  const y = Math.max(0, Math.min(rows - 1, wy))
  const x0 = Math.max(0, Math.min(cols - 1, Math.floor(x)))
  const x1 = Math.max(0, Math.min(cols - 1, Math.ceil(x)))
  const y0 = Math.max(0, Math.min(rows - 1, Math.floor(y)))
  const y1 = Math.max(0, Math.min(rows - 1, Math.ceil(y)))
  const fx = x - Math.floor(x)
  const fy = y - Math.floor(y)
  const h00 = grid[y0][x0]
  const h10 = grid[y0][x1]
  const h01 = grid[y1][x0]
  const h11 = grid[y1][x1]
  const h0 = h00 + (h10 - h00) * fx
  const h1 = h01 + (h11 - h01) * fx
  return h0 + (h1 - h0) * fy
}

function sampleGrid2D(grid, nx, ny) {
  const rows = grid.length, cols = grid[0].length
  const x = nx * (cols - 1), y = ny * (rows - 1)
  const x0 = Math.max(0, Math.min(cols - 1, Math.floor(x)))
  const x1 = Math.max(0, Math.min(cols - 1, Math.ceil(x)))
  const y0 = Math.max(0, Math.min(rows - 1, Math.floor(y)))
  const y1 = Math.max(0, Math.min(rows - 1, Math.ceil(y)))
  const fx = x - Math.floor(x), fy = y - Math.floor(y)
  const h00 = grid[y0][x0], h10 = grid[y0][x1], h01 = grid[y1][x0], h11 = grid[y1][x1]
  return h00 + (h10 - h00) * fx + ((h01 + (h11 - h01) * fx) - (h00 + (h10 - h00) * fx)) * fy
}

function generateZona(world, macroX, macroY, reglas, macroData) {
  const noise = new Perlin(world.seed + macroX * 1000 + macroY)
  const [cols, rows] = world.tiles.zona
  const [mc, mr] = world.tiles.macro
  const h = [], temp = [], presion = [], hum = [], wu = [], wv = [], flora = [], rios = []

  for (let y = 0; y < rows; y++) {
    h[y] = []; temp[y] = []; presion[y] = []; hum[y] = []
    wu[y] = []; wv[y] = []; flora[y] = []; rios[y] = []
    for (let x = 0; x < cols; x++) {
      const gx = macroX * cols + x, gy = macroY * rows + y
      const fx = (x + 0.5) / cols, fy = (y + 0.5) / rows
      const wx = macroX + fx, wy = macroY + fy

      // --- 1. Rampa base (sampleGrid desde macro) ---
      const baseH = sampleGrid(macroData.H, mc, mr, wx, wy)
      const baseT = sampleGrid(macroData.TR, mc, mr, wx, wy)
      const baseP = sampleGrid(macroData.P, mc, mr, wx, wy)
      const baseHum = sampleGrid(macroData.Hum, mc, mr, wx, wy)
      const baseWU = sampleGrid(macroData.WU, mc, mr, wx, wy)
      const baseWV = sampleGrid(macroData.WV, mc, mr, wx, wy)

      // --- 2. Rango dinámico (acota ruido según baseH) ---
      const rDet = reglas.rangoDetalle ?? 0.15
      const detAmp = reglas.detalleAmp ?? 0.3
      const umbral = detAmp * 0.5
      const factorLineal = baseH < 0.5 ? Math.max(0, Math.min(1, 1 + (baseH - 0.5) / umbral)) : 1
      const factorTierra = factorLineal * factorLineal

      // --- 3. Ruido adaptativo (lerp de octavas y escala según baseH) ---
      const octF = Math.max(1, Math.min(10, (reglas.detalleOctaves ?? 3)))
      const octavas = Math.round(2 + (octF - 2) * baseH)
      const escBase = reglas.detalleEscala ?? 20
      const escala = escBase * (1 + baseH * 2)
      const detail = noise.fbm(gx, gy, octavas, escala, 1, 0.5)

      // Amplitud acotada por rango dinámico
      let amp = detAmp * factorTierra
      if (baseH > 0.85) amp *= rDet * 0.83
      else if (baseH > 0.5) amp *= rDet
      else amp *= rDet * 0.83

      h[y][x] = Math.max(0, Math.min(1, baseH + detail * amp))

      // --- Temperatura local ---
      const tVar = noise.fbm(gx + 500, gy + 500, 2, 30, 1, 0.5) * (reglas.varTemp ?? 0.2)
      temp[y][x] = Math.max(0, Math.min(1, baseT + tVar))

      // --- Presión local ---
      const pVar = noise.fbm(gx + 1500, gy + 1500, 2, 30, 1, 0.5) * 0.1
      presion[y][x] = Math.max(0, Math.min(1, baseP + pVar))

      // --- Humedad local (heredada de macro + variación) ---
      const hVar = noise.fbm(gx + 2000, gy + 2000, 2, 30, 1, 0.5) * (reglas.varHum ?? 0.15)
      hum[y][x] = Math.max(0, Math.min(1, baseHum + hVar))

      // --- Viento local (macro + gradiente micro) ---
      wu[y][x] = baseWU
      wv[y][x] = baseWV

      // --- Flora density (temp × hum) ---
      const fFactor = reglas.floraFactor ?? 1
      flora[y][x] = Math.max(0, Math.min(1, temp[y][x] * hum[y][x] * fFactor))
    }
  }

  // --- Viento local: refinar con gradiente micro de temperatura ---
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const px0 = x > 0 ? temp[y][x - 1] : temp[y][x]
      const px1 = x < cols - 1 ? temp[y][x + 1] : temp[y][x]
      const py0 = y > 0 ? temp[y - 1][x] : temp[y][x]
      const py1 = y < rows - 1 ? temp[y + 1][x] : temp[y][x]
      wu[y][x] += -(px1 - px0) * 0.3
      wv[y][x] += -(py1 - py0) * 0.3
    }
  }

  // --- Ríos (erosión hídrica acumulada como cauces) ---
  const eoHidrica = reglas.eoHidrica ?? 0.3
  const rain = []
  for (let y = 0; y < rows; y++) {
    rain[y] = []
    for (let x = 0; x < cols; x++) {
      rain[y][x] = Math.max(0, hum[y][x] * (1 - temp[y][x]) * 3)
    }
  }

  // Inicializar rios con la lluvia base en cada celda
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++)
      rios[y][x] = 0

  // Múltiples pases de acumulación de agua
  for (let iter = 0; iter < 3; iter++) {
    const acc = []
    for (let y = 0; y < rows; y++) { acc[y] = []; for (let x = 0; x < cols; x++) acc[y][x] = rain[y][x] }
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (h[y][x] < 0.5) continue
        let minN = h[y][x], minX = x, minY = y
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue
            const ny = y + dy, nx = x + dx
            if (ny >= 0 && ny < rows && nx >= 0 && nx < cols && h[ny][nx] < minN) {
              minN = h[ny][nx]; minX = nx; minY = ny
            }
          }
        }
        if (minY !== y || minX !== x) {
          rios[y][x] += acc[y][x] * eoHidrica * 0.15
        }
      }
    }
  }

  // Escalar rios a 0..1
  let rMin = Infinity, rMax = -Infinity
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (rios[y][x] < rMin) rMin = rios[y][x]
    if (rios[y][x] > rMax) rMax = rios[y][x]
  }
  const rRange = rMax - rMin || 1
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++)
    rios[y][x] = (rios[y][x] - rMin) / rRange

  return { h, temp, presion, hum, wu, wv, flora, rios }
}

function generateLocal(world, macroX, macroY, zonaX, zonaY, zData, reglas) {
  const noise = new Perlin(world.seed + macroX * 10000 + macroY * 1000 + zonaX * 100 + zonaY)
  const [cols, rows] = world.tiles.mapa
  const [zCols, zRows] = world.tiles.zona
  const heights = [], temps = [], hums = [], floras = [], rios = []
  for (let y = 0; y < rows; y++) {
    heights[y] = []; temps[y] = []; hums[y] = []; floras[y] = []; rios[y] = []
    for (let x = 0; x < cols; x++) {
      const ny = (zonaY * rows + y + 0.5) / (zRows * rows)
      const nx = (zonaX * cols + x + 0.5) / (zCols * cols)
      const baseH = sampleGrid2D(zData.h, nx, ny)
      const micro = noise.fbm(x * 0.3, y * 0.3, 2, 10, 0.3, 0.5) * 0.08
      heights[y][x] = Math.max(0, Math.min(1, baseH + micro))
      temps[y][x] = sampleGrid2D(zData.temp, nx, ny)
      hums[y][x] = sampleGrid2D(zData.hum, nx, ny)
      floras[y][x] = sampleGrid2D(zData.flora, nx, ny)
      rios[y][x] = sampleGrid2D(zData.rios, nx, ny)
    }
  }
  return { heights, temps, hums, floras, rios }
}

function generateBlocks(world, macroX, macroY, zonaX, zonaY, zData) {
  const reglas = world.reglas
  const macroData = generateMacro(world, reglas.macro, 12, 0)
  const local = generateLocal(world, macroX, macroY, zonaX, zonaY, zData, reglas)
  const cols = local.heights[0].length, rows = local.heights.length
  const [abajo, arriba] = [world.altura.abajo, world.altura.arriba]
  const voxH = Math.round((abajo + arriba) * 16 * 8 / rows)
  const hRange = 1
  const blocks = []
  for (let z = 0; z < rows; z++) {
    for (let x = 0; x < cols; x++) {
      const h = local.heights[z][x]
      const surfY = Math.round(h * voxH)
      const t = local.temps[z][x]
      const hum = local.hums[z][x]
      const flora = local.floras[z][x]
      const rio = local.rios[z][x]
      for (let y = 0; y <= surfY; y++) {
        let color
        const aboveWater = h >= 0.5
        if (!aboveWater) {
          color = { r: 25 / 255, g: 60 / 255, b: 120 / 255 }
        } else if (surfY - y < 1 && rio > 0.3) {
          color = { r: 40 / 255, g: 100 / 255, b: 140 / 255 }
        } else if (surfY - y < 1) {
          const green = Math.min(1, flora * 0.5 + 0.15 + t * 0.15)
          color = { r: 80 / 255 * green, g: 160 / 255 * green, b: 40 / 255 * green }
        } else if (surfY - y < 4) {
          const brown = 0.7 - (surfY - y) * 0.08
          color = { r: 140 / 255 * brown, g: 100 / 255 * brown, b: 60 / 255 * brown }
        } else {
          const gray = 0.5 + (surfY - y) / voxH * 0.4
          color = { r: gray, g: gray * 0.9, b: gray * 0.8 }
        }
        blocks.push({ x, y, z, color })
      }
    }
  }
  return blocks
}

// --- Erosión hidráulica ---
function aplicarErosion(H, R, cols, rows, factor, años) {
  const delta = []
  for (let y = 0; y < rows; y++) {
    delta[y] = []
    for (let x = 0; x < cols; x++) delta[y][x] = 0
  }
  for (let iter = 0; iter < años; iter++) {
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        if (H[y][x] < 0.5) continue
        const hSlope = Math.abs(H[y][x] - H[y - 1][x]) + Math.abs(H[y][x] - H[y + 1][x])
        const vSlope = Math.abs(H[y][x] - H[y][x - 1]) + Math.abs(H[y][x] - H[y][x + 1])
        const slope = (hSlope + vSlope) * 2.5
        const amount = R[y][x] * slope * factor
        if (amount > 0.00001) {
          let minN = H[y][x], minX = x, minY = y
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue
              const ny = y + dy, nx = x + dx
              if (ny >= 0 && ny < rows && nx >= 0 && nx < cols && H[ny][nx] < minN) {
                minN = H[ny][nx]; minX = nx; minY = ny
              }
            }
          }
          if (minY !== y || minX !== x) {
            H[y][x] -= amount
            H[minY][minX] += amount * 0.6
            delta[y][x] -= amount
            delta[minY][minX] += amount * 0.6
          }
        }
      }
    }
  }
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++)
      H[y][x] = Math.max(0, Math.min(1, H[y][x]))
  return delta
}

// --- Rendering ---
function tempColor(t, alpha) {
  const v = Math.max(0, Math.min(1, t))
  const r = Math.round(v * 255)
  const b = Math.round((1 - v) * 255)
  if (alpha !== undefined) return `rgba(${r},40,${b},${alpha})`
  return `rgb(${r},40,${b})`
}

function depthColor(h, minH, maxH) {
  const range = maxH - minH || 1
  const t = (h - minH) / range // 0..1
  // Warm→Cold: low = cálido, high = frío (a más altura más frío)
  const stops = [
    [0.00, 15, 15, 60],    // deep ocean
    [0.15, 25, 45, 120],   // ocean
    [0.30, 30, 90, 170],   // shallow
    [0.42, 60, 140, 190],  // coast
    [0.48, 190, 180, 110], // beach / arena cálida
    [0.52, 120, 170, 60],  // lowland
    [0.60, 140, 150, 50],  // grassland
    [0.75, 150, 120, 70],  // hills (menos cálido)
    [0.88, 90, 100, 140],  // mountains fríos
    [1.00, 180, 200, 240], // nieve — azul frío
  ]
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, r0, g0, b0] = stops[i]
    const [t1, r1, g1, b1] = stops[i + 1]
    if (t >= t0 && t <= t1) {
      const f = (t - t0) / (t1 - t0)
      const r = Math.round(r0 + (r1 - r0) * f)
      const g = Math.round(g0 + (g1 - g0) * f)
      const b = Math.round(b0 + (b1 - b0) * f)
      return `rgb(${r},${g},${b})`
    }
  }
  return 'rgb(220,220,230)'
}

function heightGray(h, minH, maxH) {
  const range = maxH - minH || 1
  const t = (h - minH) / range
  const stops = [
    [0.00, 0, 0, 0],
    [0.20, 50, 50, 50],
    [0.40, 100, 100, 100],
    [0.60, 155, 155, 155],
    [0.80, 210, 210, 210],
    [1.00, 255, 255, 255],
  ]
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, r0, g0, b0] = stops[i]
    const [t1, r1, g1, b1] = stops[i + 1]
    if (t >= t0 && t <= t1) {
      const f = (t - t0) / (t1 - t0)
      return `rgb(${Math.round(r0 + (r1 - r0) * f)},${Math.round(g0 + (g1 - g0) * f)},${Math.round(b0 + (b1 - b0) * f)})`
    }
  }
  return 'rgb(255,255,255)'
}

function biomeColor(temp, hum) {
  const t = Math.max(0, Math.min(1, temp))
  const h = Math.max(0, Math.min(1, hum))
  const r = Math.round(60 + h * 100 + (1 - t) * 60)
  const g = Math.round(60 + h * 120 + t * 40)
  const b = Math.round(40 + (1 - t) * 40 + (1 - h) * 20)
  return `rgb(${r},${g},${b})`
}

function humColor(v, alpha) {
  const t = Math.max(0, Math.min(1, v))
  const g = Math.round(180 - t * 50)
  const b = Math.round(40 + t * 215)
  const r = Math.round(40 + t * 80)
  if (alpha !== undefined) return `rgba(${r},${g},${b},${alpha})`
  return `rgb(${r},${g},${b})`
}

function eroColor(v, alpha) {
  const t = Math.max(-1, Math.min(1, v * 100))
  if (t > 0) {
    const r = Math.round(20 + t * 100)
    const g = Math.round(20 + t * 40)
    const b = Math.round(80 + t * 175)
    if (alpha !== undefined) return `rgba(${r},${g},${b},${alpha})`
    return `rgb(${r},${g},${b})`
  }
  const r = Math.round(180 + t * 100)
  const g = Math.round(60 + t * 60)
  const b = Math.round(60 + t * 40)
  if (alpha !== undefined) return `rgba(${r},${g},${b},${alpha})`
  return `rgb(${r},${g},${b})`
}

function rainColor(v, alpha) {
  const t = Math.max(0, Math.min(1, v))
  const r = Math.round(30 + t * 60)
  const g = Math.round(30 + t * 80)
  const b = Math.round(80 + t * 175)
  if (alpha !== undefined) return `rgba(${r},${g},${b},${alpha})`
  return `rgb(${r},${g},${b})`
}

function pressureColor(v, alpha) {
  const t = Math.max(0, Math.min(1, v))
  const g = Math.round(220 - t * 120)
  const r = Math.round(60 + t * 195)
  const b = Math.round(60 + t * 195)
  if (alpha !== undefined) return `rgba(${r},${g},${b},${alpha})`
  return `rgb(${r},${g},${b})`
}

function windColor(v, alpha) {
  const t = Math.max(0, Math.min(1, v))
  const g = Math.round(200 - t * 100)
  const r = Math.round(50 + t * 205)
  const b = Math.round(50 + t * 205)
  if (alpha !== undefined) return `rgba(${r},${g},${b},${alpha})`
  return `rgb(${r},${g},${b})`
}

function floraColor(v, alpha) {
  const t = Math.max(0, Math.min(1, v))
  const r = Math.round(20 + t * 40)
  const g = Math.round(40 + t * 180)
  const b = Math.round(20 + t * 40)
  if (alpha !== undefined) return `rgba(${r},${g},${b},${alpha})`
  return `rgb(${r},${g},${b})`
}

function rioColor(v, alpha) {
  const t = Math.max(0, Math.min(1, v))
  const r = Math.round(30 + t * 50)
  const g = Math.round(80 + t * 120)
  const b = Math.round(120 + t * 135)
  if (alpha !== undefined) return `rgba(${r},${g},${b},${alpha})`
  return `rgb(${r},${g},${b})`
}

function terrainColor(h, temp) {
  const t = Math.max(0, Math.min(1, h))
  const tm = Math.max(0, Math.min(1, temp))
  if (t < 0.5) {
    const depth = 1 - t / 0.5
    const r = Math.round(5 + depth * 55)
    const g = Math.round(10 + depth * 130)
    const b = Math.round(50 + depth * 140)
    return `rgb(${r},${g},${b})`
  }
  const land = (t - 0.5) / 0.5
  if (land < 0.1) {
    const beach = land / 0.1
    const r = Math.round(170 + beach * 20)
    const g = Math.round(150 + beach * 30)
    const b = Math.round(100 + beach * 10)
    return `rgb(${r},${g},${b})`
  }
  const cold = 1 - tm
  if (land < 0.4) {
    const f = (land - 0.1) / 0.3
    const base = tm > 0.6 ? 1 : tm > 0.3 ? 0.6 : 0.2
    const r = Math.round((80 + f * 60) * base + cold * 80)
    const g = Math.round((120 + f * 30) * base + cold * 60)
    const b = Math.round((40 + f * 20) * base + cold * 80)
    return `rgb(${Math.min(255,r)},${Math.min(255,g)},${Math.min(255,b)})`
  }
  if (land < 0.7) {
    const f = (land - 0.4) / 0.3
    const r = Math.round((140 + f * 10) * (1 - cold * 0.3) + cold * 120)
    const g = Math.round((150 - f * 20) * (1 - cold * 0.3) + cold * 100)
    const b = Math.round((60 + f * 60) * (1 - cold * 0.3) + cold * 120)
    return `rgb(${Math.min(255,r)},${Math.min(255,g)},${Math.min(255,b)})`
  }
  const snow = (land - 0.7) / 0.3
  const r = Math.round(150 + snow * 60 + cold * 20)
  const g = Math.round(150 + snow * 70 + cold * 20)
  const b = Math.round(150 + snow * 90 + cold * 20)
  return `rgb(${Math.min(255,r)},${Math.min(255,g)},${Math.min(255,b)})`
}

function biomeOverlayColor(v, alpha) {
  const t = Math.max(0, Math.min(1, v))
  const rp = Math.round(80 + t * 120)
  const gp = Math.round(160 - t * 80)
  const bp = Math.round(60 + t * 100)
  if (alpha !== undefined) return `rgba(${rp},${gp},${bp},${alpha})`
  return `rgb(${rp},${gp},${bp})`
}

function render2D() {
  if (!previewCtx || !worldData) return
  if (fullMapView) return
  const ctx = previewCtx
  const canvas = previewCanvas
  const container = canvas.parentElement
  const w = container.clientWidth - 4, h = container.clientHeight - 4
  canvas.width = w; canvas.height = h

  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, w, h)

  const reglas = worldData.reglas
  const activeLayer = layerStack.length > 0 ? layerStack[layerStack.length - 1] : 'macro'
  const showHeat = document.getElementById('wg-show-heat')?.checked !== false
  const showDepth = document.getElementById('wg-show-depth')?.checked !== false
  const showWind = document.getElementById('wg-show-wind')?.checked !== false
  const showPressure = document.getElementById('wg-show-pressure')?.checked !== false
  const showTec = document.getElementById('wg-show-tec')?.checked !== false
  const showHum = document.getElementById('wg-show-hum')?.checked !== false
  const showRain = document.getElementById('wg-show-rain')?.checked !== false
  const showErosion = document.getElementById('wg-show-erosion')?.checked !== false
  const showBiome = document.getElementById('wg-show-biome')?.checked !== false
  const showTerrain = document.getElementById('wg-show-terrain')?.checked !== false
  const hGlobal = worldData.horaGlobal ?? 6
  const estGlobal = reglas.macro.estacion ?? 0

  if (activeLayer === 'macro') {
    const data = generateMacro(worldData, reglas.macro, hGlobal, estGlobal)
    const [cols, rows] = worldData.tiles.macro
    const cw = w / cols, ch = h / rows
    const años = reglas.macro.añosErosion ?? 0
    const eroFactor = reglas.macro.erosionFactor ?? 0.005
    if (años > 0 && eroFactor > 0) {
      data.erosionDelta = aplicarErosion(data.H, data.R, cols, rows, eroFactor, años)
    }
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (showTerrain) {
          ctx.fillStyle = terrainColor(data.H[y][x], data.TL[y][x])
        } else if (showDepth) {
          ctx.fillStyle = heightGray(data.H[y][x], data.minH, data.maxH)
        } else {
          ctx.fillStyle = '#1a1a1a'
        }
        ctx.fillRect(x * cw, y * ch, cw, ch)

        if (showHeat) {
          ctx.fillStyle = tempColor(data.TR[y][x], 0.2)
          ctx.fillRect(x * cw, y * ch, cw, ch)
        }
        if (showPressure) {
          ctx.fillStyle = pressureColor(data.P[y][x], 0.2)
          ctx.fillRect(x * cw, y * ch, cw, ch)
        }
        if (showWind) {
          ctx.fillStyle = windColor(data.WS[y][x], 0.2)
          ctx.fillRect(x * cw, y * ch, cw, ch)
        }
        if (showHum) {
          ctx.fillStyle = humColor(data.Hum[y][x], 0.2)
          ctx.fillRect(x * cw, y * ch, cw, ch)
        }
        if (showRain) {
          ctx.fillStyle = rainColor(data.R[y][x], 0.2)
          ctx.fillRect(x * cw, y * ch, cw, ch)
        }
        if (showErosion && data.erosionDelta) {
          ctx.fillStyle = eroColor(data.erosionDelta[y][x], 0.25)
          ctx.fillRect(x * cw, y * ch, cw, ch)
        }
        if (selMacro && selMacro[0] === x && selMacro[1] === y) {
          ctx.strokeStyle = '#44ccff'; ctx.lineWidth = 3; ctx.strokeRect(x * cw, y * ch, cw, ch)
        }
      }
    }
    if (showTec && data.faultSegments) {
      ctx.lineWidth = 3
      ctx.strokeStyle = 'rgba(255,180,80,0.7)'
      ctx.beginPath()
      for (const f of data.faultSegments) {
        ctx.moveTo(f.x1 * cw, f.y1 * ch)
        ctx.lineTo(f.x2 * cw, f.y2 * ch)
      }
      ctx.stroke()
      // Up-side markers
      for (const f of data.faultSegments) {
        const mx = (f.x1 + f.x2) / 2 * cw, my = (f.y1 + f.y2) / 2 * ch
        ctx.fillStyle = f.upSide > 0 ? 'rgba(255,100,100,0.5)' : 'rgba(100,100,255,0.5)'
        ctx.beginPath()
        ctx.arc(mx + Math.cos(f.upAngle) * 10, my + Math.sin(f.upAngle) * 10, 4, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  } else if (activeLayer === 'zona' && selMacro) {
    const macroData = generateMacro(worldData, reglas.macro, hGlobal, estGlobal)
    const zData = generateZona(worldData, selMacro[0], selMacro[1], reglas.zona, macroData)
    const [cols, rows] = worldData.tiles.zona
    const cw = w / cols, ch = h / rows
    const zRange = macroData.maxH - macroData.minH || 1
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (showTerrain) {
          ctx.fillStyle = terrainColor(zData.h[y][x], zData.temp[y][x])
        } else if (showDepth) {
          const t = (zData.h[y][x] - macroData.minH) / zRange
          const gray = Math.round(Math.max(0, Math.min(1, t)) * 255)
          ctx.fillStyle = `rgb(${gray},${gray},${gray})`
        } else {
          ctx.fillStyle = '#1a1a1a'
        }
        ctx.fillRect(x * cw, y * ch, cw, ch)

        if (showHeat) {
          ctx.fillStyle = tempColor(zData.temp[y][x], 0.3)
          ctx.fillRect(x * cw, y * ch, cw, ch)
        }
        if (showHum) {
          ctx.fillStyle = humColor(zData.hum[y][x], 0.25)
          ctx.fillRect(x * cw, y * ch, cw, ch)
        }
        if (showWind) {
          const ws = Math.min(1, Math.sqrt(zData.wu[y][x] ** 2 + zData.wv[y][x] ** 2))
          ctx.fillStyle = windColor(ws, 0.2)
          ctx.fillRect(x * cw, y * ch, cw, ch)
        }
        if (showRain) {
          ctx.fillStyle = rioColor(zData.rios[y][x], 0.3)
          ctx.fillRect(x * cw, y * ch, cw, ch)
        }
        if (showErosion) {
          ctx.fillStyle = eroColor(zData.rios[y][x] > 0.3 ? -zData.rios[y][x] : 0, 0.25)
          ctx.fillRect(x * cw, y * ch, cw, ch)
        }
        if (showBiome) {
          ctx.fillStyle = biomeColor(zData.temp[y][x], zData.hum[y][x])
          ctx.globalAlpha = 0.4
          ctx.fillRect(x * cw, y * ch, cw, ch)
          ctx.globalAlpha = 1
        }
        if (selZona && selZona[0] === x && selZona[1] === y) {
          ctx.strokeStyle = '#44ccff'; ctx.lineWidth = 3; ctx.strokeRect(x * cw, y * ch, cw, ch)
        }
      }
    }
  } else if (activeLayer === 'mapa' && selMacro && selZona) {
    const macroData = generateMacro(worldData, reglas.macro, hGlobal, estGlobal)
    const zData = generateZona(worldData, selMacro[0], selMacro[1], reglas.zona, macroData)
    const lData = generateLocal(worldData, selMacro[0], selMacro[1], selZona[0], selZona[1], zData, reglas)
    const [cols, rows] = worldData.tiles.mapa
    const cw = w / cols, ch = h / rows
    const hRange = 1
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const h = lData.heights[y][x]
        if (showTerrain) {
          ctx.fillStyle = terrainColor(h, lData.temps[y][x])
          ctx.fillRect(x * cw, y * ch, cw, ch)
        } else if (showDepth) {
          ctx.fillStyle = h >= 0.5 ? depthColor(h, 0, 1) : depthColor(h * 0.44, 0, 1)
          ctx.fillRect(x * cw, y * ch, cw, ch)
        } else {
          ctx.fillStyle = '#1a1a1a'
          ctx.fillRect(x * cw, y * ch, cw, ch)
        }
        if (showHeat) {
          ctx.fillStyle = tempColor(lData.temps[y][x], 0.3)
          ctx.fillRect(x * cw, y * ch, cw, ch)
        }
        if (showHum) {
          ctx.fillStyle = humColor(lData.hums[y][x], 0.25)
          ctx.fillRect(x * cw, y * ch, cw, ch)
        }
        if (showRain) {
          ctx.fillStyle = rioColor(lData.rios[y][x], 0.3)
          ctx.fillRect(x * cw, y * ch, cw, ch)
        }
        if (showBiome) {
          ctx.fillStyle = biomeColor(lData.temps[y][x], lData.hums[y][x])
          ctx.globalAlpha = 0.4
          ctx.fillRect(x * cw, y * ch, cw, ch)
          ctx.globalAlpha = 1
        }
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
  const macroData = generateMacro(worldData, reglas.macro, worldData.horaGlobal ?? 6, reglas.macro.estacion ?? 0)
  for (let my = 0; my < mr; my++) {
    for (let mx = 0; mx < mc; mx++) {
      const zData = generateZona(worldData, mx, my, reglas.zona, macroData)
      for (let zy = 0; zy < zr; zy++) {
        for (let zx = 0; zx < zc; zx++) {
          const t = zData.temp[zy]?.[zx] ?? 0.5
          const hum = zData.hum[zy]?.[zx] ?? 0.5
          ctx.fillStyle = biomeColor(t, hum)
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
  const gs2 = Math.max(worldData.tiles.mapa[0], 12)
  camera3d = new THREE.PerspectiveCamera(50, w / h, 0.1, 200)
  camera3d.position.set(gs2 * 1.5, gs2, gs2 * 1.5)
  renderer3d = new THREE.WebGLRenderer({ antialias: true })
  renderer3d.setSize(w, h)
  container.appendChild(renderer3d.domElement)
  controls3d = new OrbitControls(camera3d, renderer3d.domElement)
  controls3d.target.set(gs2 / 2, 0, gs2 / 2)
  controls3d.enableDamping = true

  const ambient = new THREE.AmbientLight(0xffffff, 0.4)
  scene3d.add(ambient)
  const dir = new THREE.DirectionalLight(0xffffff, 0.8)
  dir.position.set(10, 20, 10)
  scene3d.add(dir)

  const grid = new THREE.GridHelper(gs2, gs2, 0x444444, 0x333333)
  grid.position.set(gs2 / 2 - 0.5, -0.5, gs2 / 2 - 0.5)
  scene3d.add(grid)

  animate3D()
}

function animate3D() {
  animFrame = requestAnimationFrame(animate3D)
  if (controls3d) controls3d.update()
  if (renderer3d && scene3d && camera3d) renderer3d.render(scene3d, camera3d)
}

function showMap3D(macroX, macroY, zonaX, zonaY) {
  if (!scene3d) return
  while (scene3d.children.length > 3) scene3d.remove(scene3d.children[3])
  const reglas = worldData.reglas
  const macroData = generateMacro(worldData, reglas.macro, hGlobal, estGlobal)
  const zData = generateZona(worldData, macroX, macroY, reglas.zona, macroData)
  const blocks = generateBlocks(worldData, macroX, macroY, zonaX, zonaY, zData)
  const cols = worldData.tiles.mapa[0]
  const geom = new THREE.BoxGeometry(0.9, 0.9, 0.9)
  const mat = new THREE.MeshStandardMaterial({ vertexColors: false })
  const count = Math.min(blocks.length, 30000)
  const merged = new THREE.InstancedMesh(geom, mat, count)
  const dummy = new THREE.Object3D()
  const color = new THREE.Color()
  let idx = 0
  for (const b of blocks) {
    if (idx >= count) break
    dummy.position.set(b.x, b.y, b.z)
    dummy.updateMatrix()
    merged.setMatrixAt(idx, dummy.matrix)
    if (b.color) {
      color.setRGB(b.color.r, b.color.g, b.color.b)
      merged.setColorAt(idx, color)
    }
    idx++
  }
  merged.count = idx
  merged.instanceMatrix.needsUpdate = true
  if (merged.instanceColor) merged.instanceColor.needsUpdate = true
  scene3d.add(merged)
  controls3d.target.set(cols / 2, 0, cols / 2)
}

function toggle3D() {
  show3d = !show3d
  const vp = document.getElementById('wg-viewport')
  const canvas3d = document.getElementById('wg-canvas3d')
  if (show3d) {
    previewCanvas.style.display = 'none'
    canvas3d.style.display = 'block'
    init3D(canvas3d)
    if (selMacro && selZona) {
      showMap3D(selMacro[0], selMacro[1], selZona[0], selZona[1])
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
      render2D(); renderLayerNav(); renderReglas()
    }
  } else if (activeLayer === 'zona' && selMacro) {
    const [cols, rows] = worldData.tiles.zona
    const cw = w / cols, ch = h / rows
    const x = Math.floor(cx / cw), y = Math.floor(cy / ch)
    if (x >= 0 && x < cols && y >= 0 && y < rows) {
      selZona = [x, y]; selMapa = null
      layerStack.push('mapa')
      render2D(); renderLayerNav(); renderReglas()
    }
  } else if (activeLayer === 'mapa' && selMacro && selZona) {
    const [cols, rows] = worldData.tiles.mapa
    const cw = w / cols, ch = h / rows
    const x = Math.floor(cx / cw), y = Math.floor(cy / ch)
    if (x >= 0 && x < cols && y >= 0 && y < rows) {
      selMapa = [x, y]
      if (show3d) showMap3D(selMacro[0], selMacro[1], selZona[0], selZona[1])
      render2D(); renderLayerNav()
    }
  }
}

function renderLayerNav() {
  const el = document.getElementById('wg-layers')
  if (!el || !worldData) return

  const cl = (name, active, onClick) =>
    `<div class="wg-layer-btn${active ? ' active' : ''}" data-layer="${onClick}" style="padding:6px 10px;border-radius:6px;cursor:pointer;font-size:13px;margin-bottom:2px;${active ? 'background:#2a4a3a;color:#fff;font-weight:600' : 'color:#aaa'}"
       onmouseenter="this.style.background='${active ? '#2a4a3a' : '#2a2a2a'}'" onmouseleave="this.style.background='${active ? '#2a4a3a' : 'transparent'}'">${name.charAt(0).toUpperCase() + name.slice(1)}</div>`

  const layer = layerStack.length > 0 ? layerStack[layerStack.length - 1] : 'macro'
  const t = worldData.tiles
  const isMacro = layer === 'macro'
  const isZona = layer === 'zona'
  const isMapa = layer === 'mapa'

  let html = '<div style="font-size:12px;font-weight:600;color:#44aa88;margin-bottom:6px">CAPAS</div>'
  html += cl(`Macro (${t.macro[0]}×${t.macro[1]})`, isMacro, 'macro')
  if (selMacro || isZona || isMapa) {
    html += '<div style="padding-left:16px">' + cl(`Zona (${t.zona[0]}×${t.zona[1]})`, isZona, 'zona') + '</div>'
  }
  if (selZona || isMapa) {
    html += '<div style="padding-left:32px">' + cl(`Mapa (${t.mapa[0]}×${t.mapa[1]})`, isMapa, 'mapa') + '</div>'
  }

  el.innerHTML = html
  el.querySelectorAll('.wg-layer-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const l = btn.dataset.layer
      if (l === 'macro') { layerStack = ['macro']; selMacro = null; selZona = null; selMapa = null }
      else if (l === 'zona') { if (!selMacro) selMacro = [0, 0]; layerStack = ['macro', 'zona']; selZona = null; selMapa = null }
      else if (l === 'mapa') { if (!selMacro) selMacro = [0, 0]; if (!selZona) selZona = [0, 0]; layerStack = ['macro', 'zona', 'mapa']; selMapa = null }
      render2D(); renderLayerNav(); renderReglas()
    })
  })
}

function renderReglas() {
  const el = document.getElementById('wg-reglas')
  if (!el || !worldData) return
  const activeLayer = layerStack.length > 0 ? layerStack[layerStack.length - 1] : 'macro'
  const r = worldData.reglas[activeLayer] || {}

  const fields = activeLayer === 'macro' ? `
    <div style="font-size:12px;font-weight:600;color:#44aa88;margin-bottom:6px">DISTORSIÓN</div>
    <div class="wg-label">Frecuencia</div><input id="wg-distFrec" type="number" step="0.05" min="0.05" max="2" value="${r.distorsionFrecuencia ?? 0.3}" style="width:100%;margin-bottom:6px">
    <div class="wg-label">Magnitud</div><input id="wg-distMag" type="number" step="1" min="0" max="100" value="${r.distorsionMagnitud ?? 20}" style="width:100%;margin-bottom:6px">

    <hr style="border:none;border-top:1px solid #2a2a2a;margin:10px 0">

    <div style="font-size:12px;font-weight:600;color:#44aa88;margin-bottom:6px">CONTINENTES</div>
    <div class="wg-label">Cota del mar</div><input id="wg-cotaMar" type="number" step="0.01" min="0" max="1" value="${r.cotaMar ?? 0.45}" style="width:100%;margin-bottom:6px">
    <div class="wg-label">Transición costa</div><input id="wg-transCosta" type="number" step="0.01" min="0.01" max="0.5" value="${r.transicionCosta ?? 0.1}" style="width:100%;margin-bottom:6px">

    <hr style="border:none;border-top:1px solid #2a2a2a;margin:10px 0">

    <div style="font-size:12px;font-weight:600;color:#44aa88;margin-bottom:6px">DETALLE</div>
    <div class="wg-label">Ruido detalle</div><input id="wg-detRuido" type="number" step="1" min="1" max="200" value="${r.detalleRuido ?? 30}" style="width:100%;margin-bottom:6px">
    <div class="wg-label">Octaves detalle</div><input id="wg-detOct" type="number" step="1" min="1" max="10" value="${r.detalleOctaves ?? 4}" style="width:100%;margin-bottom:6px">

    <hr style="border:none;border-top:1px solid #2a2a2a;margin:10px 0">

    <div style="font-size:12px;font-weight:600;color:#44aa88;margin-bottom:6px">TECTÓNICA</div>
    <div class="wg-label">Puntos de falla (1–10)</div><input id="wg-placas" type="number" step="1" min="1" max="10" value="${r.placas ?? 4}" style="width:100%;margin-bottom:6px">
    <div class="wg-label">Fuerza tectónica</div><input id="wg-tectF" type="number" step="0.05" min="0" max="2" value="${r.tectFuerza ?? 0.5}" style="width:100%;margin-bottom:6px">
    <div class="wg-label">Elevación bordes</div><input id="wg-tectUp" type="number" step="0.05" min="0" max="1" value="${r.tectElevacion ?? 0.3}" style="width:100%;margin-bottom:6px">
    <div class="wg-label">Subsidencia bordes</div><input id="wg-tectDown" type="number" step="0.05" min="0" max="1" value="${r.tectSubsidencia ?? 0.2}" style="width:100%;margin-bottom:6px">

    <hr style="border:none;border-top:1px solid #2a2a2a;margin:10px 0">

    <div style="font-size:12px;font-weight:600;color:#44aa88;margin-bottom:6px">CLIMA / VIENTO</div>
    <div class="wg-label">Escala viento</div><input id="wg-vientoEsc" type="number" step="0.1" min="0" max="5" value="${r.vientoEscala ?? 1}" style="width:100%;margin-bottom:6px">
    <div style="font-size:11px;color:#666;margin-top:4px">El viento se acelera en crestas y se frena en valles.</div>

    <hr style="border:none;border-top:1px solid #2a2a2a;margin:10px 0">

    <div style="font-size:12px;font-weight:600;color:#44aa88;margin-bottom:6px">TEMPERATURA</div>
    <div class="wg-label">Enfriamiento por altura</div>
    <input id="wg-altTemp" type="range" min="0" max="1" step="0.05" value="${r.alturaInflTemp ?? 0.3}" style="width:100%;margin-bottom:2px">
    <div id="wg-altTemp-val" style="font-size:11px;color:#888;margin-bottom:6px">${(r.alturaInflTemp ?? 0.3).toFixed(2)}</div>
    <div style="font-size:11px;color:#666;margin-top:4px">Norte = 0, Centro = 1, Sur = 0. La altura enfría.</div>

    <hr style="border:none;border-top:1px solid #2a2a2a;margin:10px 0">

    <div style="font-size:12px;font-weight:600;color:#44aa88;margin-bottom:6px">HUMEDAD / LLUVIA</div>
    <div class="wg-label">Escala humedad</div>
    <input id="wg-humEsc" type="number" step="0.1" min="0" max="2" value="${r.humEscala ?? 0.5}" style="width:100%;margin-bottom:6px">
    <div class="wg-label">Factor lluvia</div>
    <input id="wg-lluviaF" type="number" step="0.1" min="0" max="5" value="${r.lluviaFactor ?? 1}" style="width:100%;margin-bottom:6px">
    <div class="wg-label">Dist. máxima costas</div>
    <input id="wg-distCostas" type="number" step="0.5" min="0.5" max="20" value="${r.distMaxCostas ?? 5}" style="width:100%;margin-bottom:6px">
    <div style="font-size:11px;color:#666;margin-top:4px">La humedad viaja desde océanos por el viento. Precipita al chocar con pendientes.</div>

    <hr style="border:none;border-top:1px solid #2a2a2a;margin:10px 0">

    <div style="font-size:12px;font-weight:600;color:#44aa88;margin-bottom:6px">TIEMPO / ESTACIÓN</div>
    <div class="wg-label">Velocidad del día (min reales)</div>
    <input id="wg-velDia" type="number" step="1" min="1" max="120" value="${r.velocidadDia ?? 25}" style="width:100%;margin-bottom:6px">
    <div class="wg-label">Estación</div>
    <select id="wg-estacion" style="width:100%;margin-bottom:6px">
      <option value="0"${(r.estacion ?? 0) === 0 ? ' selected' : ''}>Primavera</option>
      <option value="1"${(r.estacion ?? 0) === 1 ? ' selected' : ''}>Verano</option>
      <option value="2"${(r.estacion ?? 0) === 2 ? ' selected' : ''}>Otoño</option>
      <option value="3"${(r.estacion ?? 0) === 3 ? ' selected' : ''}>Invierno</option>
    </select>
    <div style="font-size:11px;color:#666;margin-top:4px">Estación modifica temperatura global y duración del día.</div>

    <hr style="border:none;border-top:1px solid #2a2a2a;margin:10px 0">

    <div style="font-size:12px;font-weight:600;color:#44aa88;margin-bottom:6px">EROSIÓN HÍDRICA</div>
    <div class="wg-label">Factor de erosión</div>
    <input id="wg-eroFactor" type="number" step="0.001" min="0" max="0.1" value="${r.erosionFactor ?? 0.005}" style="width:100%;margin-bottom:6px">
    <div class="wg-label">Años de erosión</div>
    <input id="wg-eroAnios" type="number" step="1" min="0" max="10000" value="${r.añosErosion ?? 0}" style="width:100%;margin-bottom:6px">
    <div style="font-size:11px;color:#666;margin-top:4px">La lluvia desgasta pendientes y deposita sedimento en zonas bajas.</div>
  ` : activeLayer === 'zona' ? `
    <div style="font-size:12px;font-weight:600;color:#44aa88;margin-bottom:6px">DETALLE SOBRE BASE MACRO</div>
    <div class="wg-label">Rango detalle</div>
    <input id="wg-znRDet" type="number" step="0.01" min="0" max="0.5" value="${r.rangoDetalle ?? 0.15}" style="width:100%;margin-bottom:6px">
    <div class="wg-label">Escala detalle</div>
    <input id="wg-znEsc" type="number" step="1" value="${r.detalleEscala || 20}" style="width:100%;margin-bottom:6px">
    <div class="wg-label">Octavas detalle</div>
    <input id="wg-znOct" type="number" step="1" min="1" max="10" value="${r.detalleOctaves || 3}" style="width:100%;margin-bottom:6px">
    <div class="wg-label">Amplitud detalle</div>
    <input id="wg-znAmp" type="number" step="0.05" value="${r.detalleAmp || 0.3}" style="width:100%;margin-bottom:6px">
    <div style="font-size:11px;color:#666;margin-top:4px">El ruido se acota según la altura base (rangoDetalle × factor).</div>

    <hr style="border:none;border-top:1px solid #2a2a2a;margin:10px 0">

    <div style="font-size:12px;font-weight:600;color:#44aa88;margin-bottom:6px">VARIACIÓN CLIMA LOCAL</div>
    <div class="wg-label">Variación temp.</div>
    <input id="wg-znVarTemp" type="number" step="0.05" min="0" max="1" value="${r.varTemp ?? 0.2}" style="width:100%;margin-bottom:6px">
    <div class="wg-label">Variación humedad</div>
    <input id="wg-znVarHum" type="number" step="0.05" min="0" max="1" value="${r.varHum ?? 0.15}" style="width:100%;margin-bottom:6px">
    <div class="wg-label">Factor flora</div>
    <input id="wg-znFloraF" type="number" step="0.05" min="0" max="2" value="${r.floraFactor ?? 1}" style="width:100%;margin-bottom:6px">
    <div style="font-size:11px;color:#666;margin-top:4px">Flora = temp × hum × factor. Sobre macro hereda altura, clima y humedad.</div>

    <hr style="border:none;border-top:1px solid #2a2a2a;margin:10px 0">

    <div style="font-size:12px;font-weight:600;color:#44aa88;margin-bottom:6px">EROSIÓN</div>
    <div class="wg-label">Eólica (0–1)</div><input id="wg-znEoEolica" type="number" step="0.05" min="0" max="1" value="${r.eoEolica ?? 0.3}" style="width:100%;margin-bottom:6px">
    <div class="wg-label">Hídrica (0–1)</div><input id="wg-znEoHidrica" type="number" step="0.05" min="0" max="1" value="${r.eoHidrica ?? 0.3}" style="width:100%;margin-bottom:6px">
    <div style="font-size:11px;color:#666;margin-top:4px">La erosión hídrica define cauces de ríos. Eólica desgasta laderas expuestas.</div>
  ` : `
    <div class="wg-label">Tipo ruido</div>
    <select id="wg-noise" style="width:100%;margin-bottom:8px"><option value="perlin">Perlin</option></select>
    <div class="wg-label">Scale</div><input id="wg-scale" type="number" step="1" value="${r.scale || 15}" style="width:100%;margin-bottom:6px">
    <div class="wg-label">Octaves</div><input id="wg-octaves" type="number" step="1" min="1" max="10" value="${r.octaves || 3}" style="width:100%;margin-bottom:6px">
    <div class="wg-label">Amplitud</div><input id="wg-amp" type="number" step="0.1" value="${r.amplitude || 10}" style="width:100%;margin-bottom:6px">
    <div class="wg-label">Persistencia</div><input id="wg-persist" type="number" step="0.05" min="0" max="1" value="${r.persistence || 0.5}" style="width:100%;margin-bottom:6px">
    <div class="wg-label">Nivel del mar</div><input id="wg-mar" type="number" step="1" value="${r.mar ?? 0}" style="width:100%;margin-bottom:6px">
  `

  el.innerHTML = `
    <div style="font-size:12px;font-weight:600;color:#44aa88;margin-bottom:10px">REGLAS — ${activeLayer.toUpperCase()}</div>
    ${fields}
    <hr style="border:none;border-top:1px solid #2a2a2a;margin:10px 0">
    <button id="wg-generate" class="btn-primary" style="width:100%">Generar</button>
  `

  const saveRegla = () => {
    const r2 = worldData.reglas[activeLayer]
    const g = id => document.getElementById(id)
    if (g('wg-mar')) r2.mar = parseFloat(g('wg-mar').value) || 0
    if (g('wg-altTemp')) {
      r2.alturaInflTemp = parseFloat(g('wg-altTemp').value) || 0
      const l = document.getElementById('wg-altTemp-val')
      if (l) l.textContent = r2.alturaInflTemp.toFixed(2)
    }
    if (g('wg-distFrec')) r2.distorsionFrecuencia = parseFloat(g('wg-distFrec').value) || 0.05
    if (g('wg-distMag')) r2.distorsionMagnitud = parseFloat(g('wg-distMag').value) || 0
    if (g('wg-cotaMar')) r2.cotaMar = parseFloat(g('wg-cotaMar').value) || 0
    if (g('wg-transCosta')) r2.transicionCosta = parseFloat(g('wg-transCosta').value) || 0.01
    if (g('wg-detRuido')) r2.detalleRuido = parseFloat(g('wg-detRuido').value) || 1
    if (g('wg-detOct')) r2.detalleOctaves = parseInt(g('wg-detOct').value) || 1
    if (g('wg-placas')) r2.placas = parseInt(g('wg-placas').value) || 1
    if (g('wg-tectF')) r2.tectFuerza = parseFloat(g('wg-tectF').value) || 0
    if (g('wg-tectUp')) r2.tectElevacion = parseFloat(g('wg-tectUp').value) || 0
    if (g('wg-tectDown')) r2.tectSubsidencia = parseFloat(g('wg-tectDown').value) || 0
    if (g('wg-vientoEsc')) r2.vientoEscala = parseFloat(g('wg-vientoEsc').value) || 0.1
    if (g('wg-humEsc')) r2.humEscala = parseFloat(g('wg-humEsc').value) || 0
    if (g('wg-lluviaF')) r2.lluviaFactor = parseFloat(g('wg-lluviaF').value) || 0
    if (g('wg-distCostas')) r2.distMaxCostas = parseFloat(g('wg-distCostas').value) || 0.5
    if (g('wg-velDia')) r2.velocidadDia = parseFloat(g('wg-velDia').value) || 25
    if (g('wg-estacion')) r2.estacion = parseInt(g('wg-estacion').value) || 0
    if (g('wg-eroFactor')) r2.erosionFactor = parseFloat(g('wg-eroFactor').value) || 0
    if (g('wg-eroAnios')) r2.añosErosion = parseInt(g('wg-eroAnios').value) || 0
    if (g('wg-znRDet')) r2.rangoDetalle = parseFloat(g('wg-znRDet').value) || 0
    if (g('wg-znEsc')) r2.detalleEscala = parseFloat(g('wg-znEsc').value) || 1
    if (g('wg-znOct')) r2.detalleOctaves = parseInt(g('wg-znOct').value) || 1
    if (g('wg-znAmp')) r2.detalleAmp = parseFloat(g('wg-znAmp').value) || 0.05
    if (g('wg-znVarTemp')) r2.varTemp = parseFloat(g('wg-znVarTemp').value) || 0
    if (g('wg-znVarHum')) r2.varHum = parseFloat(g('wg-znVarHum').value) || 0
    if (g('wg-znFloraF')) r2.floraFactor = parseFloat(g('wg-znFloraF').value) || 0
    if (g('wg-znEoEolica')) r2.eoEolica = parseFloat(g('wg-znEoEolica').value) || 0
    if (g('wg-znEoHidrica')) r2.eoHidrica = parseFloat(g('wg-znEoHidrica').value) || 0
  }

  el.querySelectorAll('input, select').forEach(inp => inp.addEventListener('input', () => {
    saveRegla()
    render2D()
  }))
  document.getElementById('wg-generate')?.addEventListener('click', () => {
    saveRegla()
    render2D()
    if (show3d && selMacro && selZona) showMap3D(selMacro[0], selMacro[1], selZona[0], selZona[1])
  })
}

function newWorld() {
  currentId = null
  const n = v => [v, v]
  worldData = {
    id: uuid(),
    name: '',
    seed: Math.floor(Math.random() * 2147483647),
    tiles: { macro: n(DEFAULT_TILES.macro), zona: n(DEFAULT_TILES.zona), mapa: n(DEFAULT_TILES.mapa), mapaBlk: 8 },
    altura: { ...DEFAULT_ALTURA },
    reglas: { macro: { ...DEFAULT_REGLAS.macro }, zona: { ...DEFAULT_REGLAS.zona }, mapa: { ...DEFAULT_REGLAS.mapa } },
    deltas: {},
    estructuras: [],
  }
  worldData.horaGlobal = 6
  layerStack = ['macro']; selMacro = null; selZona = null; selMapa = null
  document.getElementById('wg-name').value = ''
  document.getElementById('wg-seed').value = worldData.seed
  const setNum = (id, v) => { const el = document.getElementById(id); if (el) el.value = v }
  setNum('wg-msize', DEFAULT_TILES.macro)
  setNum('wg-zsize', DEFAULT_TILES.zona)
  setNum('wg-mpsize', DEFAULT_TILES.mapa)
  setNum('wg-abajo', worldData.altura.abajo); setNum('wg-arriba', worldData.altura.arriba)
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
    document.getElementById('wg-seed').value = data.seed || 0
    const setNum = (id, v) => { const el = document.getElementById(id); if (el) el.value = v }
    setNum('wg-msize', data.tiles.macro[0])
    setNum('wg-zsize', data.tiles.zona[0])
    setNum('wg-mpsize', data.tiles.mapa[0])
    setNum('wg-abajo', data.altura.abajo); setNum('wg-arriba', data.altura.arriba)
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

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function startTour() {
  if (!worldData) return
  touring = true
  const btn = document.getElementById('wg-tour')
  if (btn) btn.textContent = '■ Detener'
  const reglas = worldData.reglas
  const macroData = generateMacro(worldData, reglas.macro, worldData.horaGlobal ?? 6, reglas.macro.estacion ?? 0)
  const [mc, mr] = worldData.tiles.macro
  const [zc, zr] = worldData.tiles.zona

  for (let my = 0; my < mr && touring; my++) {
    for (let mx = 0; mx < mc && touring; mx++) {
      selMacro = [mx, my]; selZona = null; selMapa = null
      layerStack = ['macro']
      render2D(); renderLayerNav()
      await sleep(500)
      if (!touring) break

      for (let zy = 0; zy < zr && touring; zy++) {
        for (let zx = 0; zx < zc && touring; zx++) {
          selZona = [zx, zy]; selMapa = null
          layerStack = ['macro', 'zona']
          render2D(); renderLayerNav()
          await sleep(500)
          if (!touring) break

          selMapa = [0, 0]
          layerStack = ['macro', 'zona', 'mapa']
          render2D(); renderLayerNav()
          await sleep(500)
          if (!touring) break
        }
      }
    }
  }

  touring = false
  if (btn) btn.textContent = '▶ Recorrer'
}

// --- Simulación del reloj planetario ---
function tickSim() {
  if (!simPlaying || !worldData) { animSimId = null; return }
  const ahora = performance.now()
  const deltaMs = ahora - ultimoTick
  ultimoTick = ahora
  const reglas = worldData.reglas.macro
  const msPorHora = (reglas.velocidadDia * 60 * 1000) / 24
  const horas = deltaMs / msPorHora * simVelocidad
  worldData.horaGlobal = ((worldData.horaGlobal ?? 6) + horas) % 24
  const display = document.getElementById('wg-time-display')
  if (display) {
    const h = Math.floor(worldData.horaGlobal)
    const m = Math.floor((worldData.horaGlobal - h) * 60)
    const icon = worldData.horaGlobal >= 6 && worldData.horaGlobal < 18 ? '☀' : '☽'
    display.textContent = `${icon} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  render2D()
  animSimId = requestAnimationFrame(tickSim)
}

function toggleSim() {
  if (simPlaying) {
    simPlaying = false
    if (animSimId) { cancelAnimationFrame(animSimId); animSimId = null }
    const btn = document.getElementById('wg-sim-play')
    if (btn) btn.textContent = '▶'
  } else {
    simPlaying = true
    ultimoTick = performance.now()
    const btn = document.getElementById('wg-sim-play')
    if (btn) btn.textContent = '⏸'
    animSimId = requestAnimationFrame(tickSim)
  }
}

function setSimSpeed(v) {
  simVelocidad = v
  document.querySelectorAll('.wg-speed-btn').forEach(b => {
    b.style.background = parseFloat(b.dataset.speed) === v ? '#2a4a3a' : 'transparent'
    b.style.color = parseFloat(b.dataset.speed) === v ? '#4c8' : '#888'
  })
}

function renderFullMap() {
  if (!worldData) return
  const reglas = worldData.reglas
  const macroData = generateMacro(worldData, reglas.macro, worldData.horaGlobal ?? 6, reglas.macro.estacion ?? 0)
  const zRange = macroData.maxH - macroData.minH || 1
  const [mc, mr] = worldData.tiles.macro
  const [zc, zr] = worldData.tiles.zona
  const px = 8
  const useTerrain = document.getElementById('wg-show-terrain')?.checked === true
  fullCanvas = document.createElement('canvas')
  fullCanvas.width = mc * zc * px
  fullCanvas.height = mr * zr * px
  const ctx = fullCanvas.getContext('2d')

  for (let my = 0; my < mr; my++) {
    for (let mx = 0; mx < mc; mx++) {
      const zData = generateZona(worldData, mx, my, reglas.zona, macroData)
      for (let zy = 0; zy < zr; zy++) {
        for (let zx = 0; zx < zc; zx++) {
          if (useTerrain) {
            ctx.fillStyle = terrainColor(zData.h[zy][zx], zData.temp[zy][zx])
          } else {
            const t = (zData.h[zy][zx] - macroData.minH) / zRange
            const gray = Math.round(Math.max(0, Math.min(1, t)) * 255)
            ctx.fillStyle = `rgb(${gray},${gray},${gray})`
          }
          ctx.fillRect((mx * zc + zx) * px, (my * zr + zy) * px, px, px)
        }
      }
    }
  }

  fullZoom = 1; fullPanX = 0; fullPanY = 0
  drawFullMap()
}

function drawFullMap() {
  const canvas = previewCanvas
  const container = canvas.parentElement
  const w = container.clientWidth - 4, h = container.clientHeight - 4
  canvas.width = w; canvas.height = h
  const ctx = previewCtx
  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, w, h)
  if (!fullCanvas) return
  ctx.save()
  ctx.translate(fullPanX, fullPanY)
  ctx.scale(fullZoom, fullZoom)
  ctx.drawImage(fullCanvas, 0, 0)
  ctx.restore()
}

export function renderWorldGenerator() {
  const app = document.getElementById('app')
  app.innerHTML = `
    <div class="tool-header">
      <h1>World Generator</h1>
      <div style="display:flex;gap:8px;align-items:center">
        <button id="wg-save" class="btn-primary">Guardar</button>
        <button id="wg-new" style="padding:5px 12px;border-radius:6px;border:1px solid #444;background:#222;color:#ddd;cursor:pointer;font-size:13px">+ Nuevo</button>
        <button id="wg-tour" style="padding:5px 12px;border-radius:6px;border:1px solid #2a6;background:#1a3a2a;color:#4c8;cursor:pointer;font-size:13px">▶ Recorrer</button>
        <button id="wg-fullmap" style="padding:5px 12px;border-radius:6px;border:1px solid #48a;background:#1a2a3a;color:#6af;cursor:pointer;font-size:13px">🗺 Vista completa</button>
      </div>
    </div>
    <div class="tool-layout" style="grid-template-columns:220px 1fr 240px">
      <div class="tool-panel" style="font-size:12px">
        <div id="wg-list" style="margin-bottom:8px;max-height:110px;overflow-y:auto"></div>

        <div class="wg-label">Nombre</div>
        <input id="wg-name" type="text" placeholder="Nombre del mundo" value="" style="width:100%;margin-bottom:6px">

        <div class="wg-label">Seed</div>
        <input id="wg-seed" type="number" step="1" value="0" style="width:100%;margin-bottom:6px">

        <div id="wg-layers"></div>

        <hr style="border:none;border-top:1px solid #2a2a2a;margin:10px 0">

        <div style="font-size:12px;font-weight:600;color:#44aa88;margin-bottom:6px">LIENZOS</div>

        <div class="wg-label">Macro</div>
        <input id="wg-msize" type="number" step="1" min="1" value="8" style="width:100%;margin-bottom:5px">

        <div class="wg-label">Zona</div>
        <input id="wg-zsize" type="number" step="1" min="1" value="4" style="width:100%;margin-bottom:5px">

        <div class="wg-label">Mapa</div>
        <input id="wg-mpsize" type="number" step="1" min="1" value="2" style="width:100%;margin-bottom:5px">

        <hr style="border:none;border-top:1px solid #2a2a2a;margin:10px 0">

        <div style="font-size:12px;font-weight:600;color:#44aa88;margin-bottom:6px">ALTURA (chunks)</div>
        <div style="display:flex;gap:4px">
          <div style="flex:1">
            <div class="wg-label">Abajo</div>
            <input id="wg-abajo" type="number" step="1" min="0" value="3" style="width:100%">
          </div>
          <div style="flex:1">
            <div class="wg-label">Arriba</div>
            <input id="wg-arriba" type="number" step="1" min="0" value="3" style="width:100%">
          </div>
        </div>
      </div>
      <div class="tool-viewport" id="wg-viewport" style="overflow:hidden;position:relative">
        <canvas id="wg-canvas" style="display:block;cursor:pointer"></canvas>
        <div id="wg-canvas3d" style="display:none;width:100%;height:100%"></div>
        <div style="position:absolute;top:8px;right:8px;z-index:10">
          <button id="wg-toggle3d" style="padding:4px 10px;border-radius:4px;border:1px solid #444;background:rgba(0,0,0,0.7);color:#ddd;cursor:pointer;font-size:11px">3D</button>
        </div>
        <div id="wg-viz-bar" style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.75);padding:4px 8px;z-index:10;display:flex;gap:6px;font-size:11px;align-items:center;flex-wrap:wrap">
          <span id="wg-time-display" style="font-size:13px;font-weight:600;color:#ffcc44;min-width:70px">☀ 06:00</span>
          <button id="wg-sim-play" style="background:none;border:1px solid #555;border-radius:4px;color:#ddd;cursor:pointer;font-size:12px;padding:2px 8px">▶</button>
          <span style="color:#666">×</span>
          <button class="wg-speed-btn" data-speed="1" style="background:#2a4a3a;border:none;border-radius:3px;color:#4c8;cursor:pointer;font-size:11px;padding:2px 6px">1</button>
          <button class="wg-speed-btn" data-speed="10" style="background:transparent;border:none;border-radius:3px;color:#888;cursor:pointer;font-size:11px;padding:2px 6px">10</button>
          <button class="wg-speed-btn" data-speed="100" style="background:transparent;border:none;border-radius:3px;color:#888;cursor:pointer;font-size:11px;padding:2px 6px">100</button>
          <button class="wg-speed-btn" data-speed="1000" style="background:transparent;border:none;border-radius:3px;color:#888;cursor:pointer;font-size:11px;padding:2px 6px">1000</button>
          <span style="color:#333">|</span>
          <label style="display:flex;align-items:center;gap:3px;cursor:pointer;color:#ddd">
            <input type="checkbox" id="wg-show-depth" checked> <span>🗻 Profundidad</span>
          </label>
          <label style="display:flex;align-items:center;gap:3px;cursor:pointer;color:#f88">
            <input type="checkbox" id="wg-show-heat" checked> <span>🌡 Calor</span>
          </label>
          <label style="display:flex;align-items:center;gap:3px;cursor:pointer;color:#ad6">
            <input type="checkbox" id="wg-show-pressure"> <span>🔄 Presión</span>
          </label>
          <label style="display:flex;align-items:center;gap:3px;cursor:pointer;color:#ad6">
            <input type="checkbox" id="wg-show-wind"> <span>🌬 Viento</span>
          </label>
          <label style="display:flex;align-items:center;gap:3px;cursor:pointer;color:#88f">
            <input type="checkbox" id="wg-show-tec"> <span>🌋 Tectónica</span>
          </label>
          <label style="display:flex;align-items:center;gap:3px;cursor:pointer;color:#4af">
            <input type="checkbox" id="wg-show-hum"> <span>💧 Humedad</span>
          </label>
          <label style="display:flex;align-items:center;gap:3px;cursor:pointer;color:#47f">
            <input type="checkbox" id="wg-show-rain"> <span>☔ Lluvia</span>
          </label>
          <label style="display:flex;align-items:center;gap:3px;cursor:pointer;color:#f84">
            <input type="checkbox" id="wg-show-erosion"> <span>🧱 Erosión</span>
          </label>
          <label style="display:flex;align-items:center;gap:3px;cursor:pointer;color:#ea0">
            <input type="checkbox" id="wg-show-terrain"> <span>🏔 Terreno</span>
          </label>
          <label style="display:flex;align-items:center;gap:3px;cursor:pointer;color:#4c4">
            <input type="checkbox" id="wg-show-biome"> <span>🌿 Bioma</span>
          </label>
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

  document.getElementById('wg-tour').addEventListener('click', () => {
    if (touring) { touring = false; document.getElementById('wg-tour').textContent = '▶ Recorrer'; return }
    startTour()
  })
  document.getElementById('wg-fullmap').addEventListener('click', () => {
    fullMapView = !fullMapView
    const btn = document.getElementById('wg-fullmap')
    if (fullMapView) {
      btn.textContent = '◀ Volver'
      renderFullMap()
    } else {
      btn.textContent = '🗺 Vista completa'
      fullCanvas = null
      fullZoom = 1; fullPanX = 0; fullPanY = 0
      render2D()
    }
  })

  ;['wg-show-heat', 'wg-show-depth', 'wg-show-wind', 'wg-show-pressure', 'wg-show-tec', 'wg-show-hum', 'wg-show-rain', 'wg-show-erosion', 'wg-show-biome', 'wg-show-terrain'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => {
      if (fullMapView) { drawFullMap(); return }
      render2D()
    })
  })

  document.getElementById('wg-sim-play').addEventListener('click', toggleSim)
  document.querySelectorAll('.wg-speed-btn').forEach(btn => {
    btn.addEventListener('click', () => setSimSpeed(parseFloat(btn.dataset.speed)))
  })

  previewCanvas.addEventListener('wheel', e => {
    if (!fullMapView || !fullCanvas) return
    e.preventDefault()
    const z = e.deltaY > 0 ? 0.9 : 1.1
    fullZoom = Math.max(1, Math.min(20, fullZoom * z))
    drawFullMap()
  })

  previewCanvas.addEventListener('mousedown', e => {
    if (!fullMapView || fullZoom <= 1) return
    fullDragging = true
    fullDragStartX = e.clientX - fullPanX
    fullDragStartY = e.clientY - fullPanY
  })
  window.addEventListener('mousemove', e => {
    if (!fullDragging) return
    fullPanX = e.clientX - fullDragStartX
    fullPanY = e.clientY - fullDragStartY
    drawFullMap()
  })
  window.addEventListener('mouseup', () => { fullDragging = false })

  const configInputs = ['wg-seed', 'wg-msize', 'wg-zsize', 'wg-mpsize', 'wg-abajo', 'wg-arriba']
  const applyConfig = () => {
    if (!worldData) return
    const n = v => Math.max(1, parseInt(v) || 1)
    worldData.seed = parseInt(document.getElementById('wg-seed').value) || 0
    const ms = n(document.getElementById('wg-msize').value)
    const zs = n(document.getElementById('wg-zsize').value)
    const mps = n(document.getElementById('wg-mpsize').value)
    worldData.tiles.macro = [ms, ms]
    worldData.tiles.zona = [zs, zs]
    worldData.tiles.mapa = [mps, mps]
    worldData.altura.abajo = n(document.getElementById('wg-abajo').value)
    worldData.altura.arriba = n(document.getElementById('wg-arriba').value)
  }
  configInputs.forEach(id => document.getElementById(id).addEventListener('input', () => {
    applyConfig()
    render2D()
  }))

  newWorld()
  renderWorldList()
}

export function cleanupWorldGenerator() {
  simPlaying = false
  if (animSimId) { cancelAnimationFrame(animSimId); animSimId = null }
  if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null }
  if (renderer3d) { renderer3d.dispose(); renderer3d = null }
  if (controls3d) { controls3d.dispose(); controls3d = null }
  currentId = null; worldData = null; scene3d = null; camera3d = null; container3d = null
  layerStack = ['macro']; selMacro = null; selZona = null; selMapa = null
  previewCanvas = null; previewCtx = null; show3d = false
}

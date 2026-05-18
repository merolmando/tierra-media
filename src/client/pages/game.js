import { start, stop, setCamera, getCamerasList, getCurrentCameraIndex,
         setLightAngle, getLightAngle, getAzimuth } from '../../engine/index.js'

const containerId = 'game-container'
let engineStarted = false
let compassInterval = null

export function renderGame() {
  const app = document.getElementById('app')
  app.innerHTML = `
    <h1 style="margin-bottom:8px">Tierra Media — Motor</h1>
    <p style="color:#888;margin-bottom:16px">
      Arrastrar para mover · Ctrl+arrastrar para orbitar · Rueda para zoom · Click para seleccionar
    </p>
    <div id="${containerId}"></div>
    <div id="game-hud" style="margin-top:12px;background:#1a1a1a;border:1px solid #333;
         border-radius:8px;padding:12px 20px;display:flex;gap:20px;align-items:center;
         flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:8px">
        <label>CÁMARA</label>
        <select id="cam-select" style="background:#222;color:#ddd;border:1px solid #444;
               border-radius:6px;padding:6px 10px;font-size:13px;cursor:pointer"></select>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <label>LUZ</label>
        <input type="range" id="light-slider" min="0" max="360" value="${getLightAngle()}"
               style="width:120px;accent-color:#44aa88">
        <span id="light-angle-label" style="font-size:12px;color:#888;min-width:30px">${Math.round(getLightAngle())}°</span>
      </div>
      <div id="compass" style="display:flex;align-items:center;gap:8px">
        <label>N</label>
        <span id="compass-arrow" style="font-size:20px;color:#fff">▲</span>
        <span id="compass-dir" style="color:#888;font-size:13px;min-width:24px">NE</span>
      </div>
    </div>
  `

  startEngine()

  const select = document.getElementById('cam-select')
  getCamerasList().forEach((c, i) => {
    const opt = document.createElement('option')
    opt.value = i
    opt.textContent = c.name
    select.appendChild(opt)
  })
  select.value = getCurrentCameraIndex()

  select.addEventListener('change', () => setCamera(parseInt(select.value)))

  const slider = document.getElementById('light-slider')
  const label = document.getElementById('light-angle-label')

  slider.addEventListener('input', () => {
    const angle = parseFloat(slider.value)
    label.textContent = Math.round(angle) + '°'
    setLightAngle(angle)
  })

  compassInterval = setInterval(updateCompass, 100)
}

function updateCompass() {
  const arrow = document.getElementById('compass-arrow')
  const dir = document.getElementById('compass-dir')
  if (!arrow || !dir) return

  const azimuth = getAzimuth()
  const deg = azimuth * 180 / Math.PI
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']
  const idx = Math.round(((deg % 360) + 360) % 360 / 45) % 8
  dir.textContent = dirs[idx]
  arrow.textContent = ['▲', '◥', '▶', '◢', '▼', '◣', '◀', '◤'][idx]
}

function startEngine() {
  if (engineStarted) return
  const container = document.getElementById(containerId)
  if (!container) return
  start(container)
  engineStarted = true
}

export function cleanupGame() {
  if (compassInterval) {
    clearInterval(compassInterval)
    compassInterval = null
  }
  if (engineStarted) {
    stop()
    engineStarted = false
    const container = document.getElementById(containerId)
    if (container) container.innerHTML = ''
  }
}

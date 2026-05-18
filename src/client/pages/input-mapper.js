let currentId = null
let bindings = []
let recordingAction = null
let codeToVisual = {}

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 11)
}

const DEFAULT_ACTIONS = [
  { action: 'move_forward', label: 'Avanzar', category: 'Movimiento' },
  { action: 'move_backward', label: 'Retroceder', category: 'Movimiento' },
  { action: 'move_left', label: 'Izquierda', category: 'Movimiento' },
  { action: 'move_right', label: 'Derecha', category: 'Movimiento' },
  { action: 'jump', label: 'Saltar', category: 'Movimiento' },
  { action: 'crouch', label: 'Agacharse', category: 'Movimiento' },
  { action: 'sprint', label: 'Correr', category: 'Movimiento' },
  { action: 'interact', label: 'Interactuar', category: 'Acción' },
  { action: 'attack', label: 'Atacar', category: 'Acción' },
  { action: 'block', label: 'Bloquear', category: 'Acción' },
  { action: 'use_item', label: 'Usar objeto', category: 'Acción' },
  { action: 'inventory', label: 'Inventario', category: 'Acción' },
  { action: 'pause', label: 'Pausa', category: 'Acción' },
  { action: 'menu', label: 'Menú', category: 'Acción' },
  { action: 'toggle_map', label: 'Mapa', category: 'Acción' },
  { action: 'zoom_in', label: 'Zoom +', category: 'Cámara' },
  { action: 'zoom_out', label: 'Zoom -', category: 'Cámara' },
]

const DEFAULT_BINDINGS = {
  move_forward: 'KeyW',
  move_backward: 'KeyS',
  move_left: 'KeyA',
  move_right: 'KeyD',
  jump: 'Space',
  crouch: 'ControlLeft',
  sprint: 'ShiftLeft',
  interact: 'KeyE',
  attack: 'Mouse0',
  block: 'Mouse1',
  use_item: 'KeyQ',
  inventory: 'KeyI',
  pause: 'Escape',
  menu: 'Tab',
  toggle_map: 'KeyM',
  zoom_in: 'Equal',
  zoom_out: 'Minus',
}

function keyCodeToVisual(code) {
  if (codeToVisual[code]) return codeToVisual[code]
  const map = {
    KeyW: 'W', KeyA: 'A', KeyS: 'S', KeyD: 'D',
    KeyQ: 'Q', KeyE: 'E', KeyR: 'R', KeyT: 'T',
    KeyY: 'Y', KeyU: 'U', KeyI: 'I', KeyO: 'O',
    KeyP: 'P', KeyF: 'F', KeyG: 'G', KeyH: 'H',
    KeyJ: 'J', KeyK: 'K', KeyL: 'L', KeyZ: 'Z',
    KeyX: 'X', KeyC: 'C', KeyV: 'V', KeyB: 'B',
    KeyN: 'N', KeyM: 'M',
    Digit0: '0', Digit1: '1', Digit2: '2', Digit3: '3',
    Digit4: '4', Digit5: '5', Digit6: '6', Digit7: '7',
    Digit8: '8', Digit9: '9',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    Space: 'Espacio', Enter: 'Enter', Escape: 'Esc',
    Tab: 'Tab', ShiftLeft: 'Shift', ShiftRight: 'Shift',
    ControlLeft: 'Ctrl', ControlRight: 'Ctrl',
    AltLeft: 'Alt', AltRight: 'Alt',
    Backspace: 'BS', Delete: 'Supr',
    BracketLeft: '[', BracketRight: ']',
    Semicolon: ';', Quote: "'", Comma: ',', Period: '.',
    Slash: '/', Backslash: '\\', Minus: '-', Equal: '=',
    Numpad0: 'Num0', Numpad1: 'Num1', Numpad2: 'Num2',
    Numpad3: 'Num3', Numpad4: 'Num4', Numpad5: 'Num5',
    Numpad6: 'Num6', Numpad7: 'Num7', Numpad8: 'Num8',
    Numpad9: 'Num9',
    Mouse0: 'Click izq', Mouse1: 'Click der', Mouse2: 'Click medio',
  }
  const v = map[code] || code
  codeToVisual[code] = v
  return v
}

function getBindingsForAction(action) {
  return bindings.filter(b => b.action === action)
}

function addBinding(action, code) {
  if (bindings.find(b => b.action === action && b.code === code)) return false
  const existing = bindings.find(b => b.code === code && b.action !== action)
  if (existing) bindings.splice(bindings.indexOf(existing), 1)
  bindings.push({ id: uuid(), action, code })
  return true
}

function removeBinding(id) {
  const idx = bindings.findIndex(b => b.id === id)
  if (idx !== -1) bindings.splice(idx, 1)
}

function renderBindings() {
  const container = document.getElementById('im-bindings')
  if (!container) return
  const cats = [...new Set(DEFAULT_ACTIONS.map(a => a.category))]
  container.innerHTML = cats.map(cat => {
    const actions = DEFAULT_ACTIONS.filter(a => a.category === cat)
    return `<div style="margin-bottom:12px">
      <div style="font-size:12px;font-weight:600;color:#44aa88;margin-bottom:6px">${cat}</div>
      ${actions.map(a => renderActionRow(a)).join('')}
    </div>`
  }).join('')

  container.querySelectorAll('.im-action-row').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.closest('.im-key') || e.target.closest('.im-add-key') || e.target.closest('.im-key-remove')) return
      renderBindings()
    })
  })
  container.querySelectorAll('.im-add-key').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); startRecording(btn.dataset.action) })
  })
  container.querySelectorAll('.im-key-remove').forEach(el => {
    el.addEventListener('click', e => { e.stopPropagation(); removeBinding(el.dataset.bindId); renderBindings() })
  })
}

function renderActionRow(a) {
  const binds = getBindingsForAction(a.action)
  const isRec = recordingAction === a.action
  return `<div class="im-action-row" data-action="${a.action}" style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;margin-bottom:4px;background:#1a1a1a"
       onmouseenter="this.style.background='#2a2a2a'" onmouseleave="this.style.background='#1a1a1a'">
    <span style="flex:1;font-size:13px;color:#ddd">${a.label}</span>
    <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap">
      ${binds.map(b => `<span class="im-key" style="display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:4px;background:#333;color:#fff;font-size:11px;font-family:monospace;border:1px solid #555;cursor:pointer">
        ${keyCodeToVisual(b.code)}
        <span class="im-key-remove" data-bind-id="${b.id}" style="color:#cc4444;font-size:12px;margin-left:2px;cursor:pointer">×</span>
      </span>`).join('')}
      ${isRec ? `<span style="padding:2px 7px;border-radius:4px;background:#442200;color:#ff8800;font-size:11px;font-family:monospace;border:1px solid #ff8800">Esperando tecla...</span>`
        : `<button class="im-add-key" data-action="${a.action}" style="padding:2px 6px;border-radius:4px;background:transparent;color:#888;border:1px dashed #555;cursor:pointer;font-size:11px">+</button>`}
    </div>
  </div>`
}

function renderMapList() {
  const container = document.getElementById('im-list')
  if (!container) return
  fetch('/api/resources/inputMaps').then(r => r.json()).then(list => {
    if (!list.length) { container.innerHTML = '<p style="color:#666;font-size:12px;padding:4px">Sin mapas.</p>'; return }
    container.innerHTML = list.map(t => `<div class="im-list-item" data-id="${t.id}" style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:6px;cursor:pointer"
         onmouseenter="this.style.background='#2a2a2a'" onmouseleave="this.style.background='transparent'">
      <span style="font-size:13px;flex:1">${escapeHtml(t.name)}</span>
      <button class="btn-delete" data-id="${t.id}" style="background:none;border:none;color:#cc4444;cursor:pointer;font-size:14px;padding:0 4px" title="Eliminar">×</button>
    </div>`).join('')
    container.querySelectorAll('.im-list-item').forEach(item => {
      item.addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') loadMap(item.dataset.id) })
    })
    container.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); if (confirm('¿Eliminar?')) deleteMap(btn.dataset.id) })
    })
  }).catch(() => { container.innerHTML = '<p style="color:#666;font-size:12px">Error.</p>' })
}

function loadMap(id) {
  fetch(`/api/resources/inputMaps/${id}`).then(r => r.json()).then(data => {
    currentId = data.id; bindings = data.bindings.map(b => ({ ...b })); recordingAction = null
    document.getElementById('im-name').value = data.name; renderMapList(); renderBindings()
  }).catch(() => alert('Error al cargar'))
}

function deleteMap(id) {
  fetch(`/api/resources/inputMaps/${id}`, { method: 'DELETE' }).then(() => {
    if (currentId === id) { currentId = null; bindings = []; recordingAction = null; document.getElementById('im-name').value = ''; renderBindings() }
    renderMapList()
  }).catch(() => alert('Error al eliminar'))
}

function saveMap() {
  const name = document.getElementById('im-name').value
  if (!name || !name.trim()) { alert('El nombre es obligatorio'); return }
  const data = { name: name.trim(), bindings: bindings.map(b => ({ id: b.id, action: b.action, code: b.code })) }
  const method = currentId ? 'PUT' : 'POST'
  const url = currentId ? `/api/resources/inputMaps/${currentId}` : '/api/resources/inputMaps'
  fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    .then(r => r.json()).then(saved => { currentId = saved.id; renderMapList() })
    .catch(() => alert('Error al guardar'))
}

function startRecording(action) { recordingAction = action; renderBindings() }

function onKeyDown(e) {
  if (!recordingAction) return
  if (e.key === 'Escape') { recordingAction = null; renderBindings(); e.preventDefault(); return }
  const code = e.code
  const validPrefixes = ['Key', 'Digit', 'Numpad', 'Arrow', 'Shift', 'Control', 'Alt', 'Bracket', 'Semicolon']
  const validExact = ['Space', 'Enter', 'Tab', 'Backspace', 'Delete', 'Escape', 'Quote', 'Comma', 'Period', 'Slash', 'Backslash', 'Minus', 'Equal']
  if (validPrefixes.some(p => code.startsWith(p)) || validExact.includes(code)) {
    addBinding(recordingAction, code); recordingAction = null; renderBindings(); e.preventDefault()
  }
}

function onMouseDown(e) {
  if (!recordingAction) return
  addBinding(recordingAction, 'Mouse' + e.button); recordingAction = null; renderBindings(); e.preventDefault()
}

function escapeHtml(str) { if (!str) return ''; return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

function newMap() {
  if (currentId && bindings.length && !confirm('¿Crear nuevo? Los cambios sin guardar se perderán.')) return
  currentId = null; bindings = []; recordingAction = null; document.getElementById('im-name').value = ''; renderBindings(); renderMapList()
}

function resetDefaults() {
  bindings = []
  Object.entries(DEFAULT_BINDINGS).forEach(([action, code]) => addBinding(action, code))
  renderBindings()
}

export function renderInputMapper() {
  document.getElementById('app').innerHTML = `
    <div class="tool-header"><h1>Input Mapper</h1></div>
    <div class="tool-layout" style="grid-template-columns:200px 1fr">
      <div class="tool-panel">
        <div style="display:flex;gap:4px;margin-bottom:8px">
          <input id="im-name" type="text" placeholder="Nombre del mapa" style="flex:1;background:#222;color:#ddd;border:1px solid #444;border-radius:6px;padding:5px 8px;font-size:13px">
          <button id="im-new" style="padding:5px 10px;border-radius:4px;border:1px solid #444;background:#222;color:#ddd;cursor:pointer;font-size:13px">+</button>
        </div>
        <button id="im-save" class="btn-primary" style="width:100%;margin-bottom:8px">Guardar</button>
        <div id="im-list" style="margin-bottom:8px"></div>
        <hr style="border:none;border-top:1px solid #2a2a2a;margin:12px 0">
        <button id="im-defaults" style="width:100%;padding:5px 8px;border-radius:4px;border:1px solid #444;background:#222;color:#ddd;cursor:pointer;font-size:11px">Restaurar defaults</button>
      </div>
      <div class="tool-panel" id="im-bindings" style="overflow-y:auto"></div>
    </div>`

  document.getElementById('im-save').addEventListener('click', saveMap)
  document.getElementById('im-new').addEventListener('click', newMap)
  document.getElementById('im-defaults').addEventListener('click', resetDefaults)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('mousedown', onMouseDown)
  renderMapList(); renderBindings()
}

export function cleanupInputMapper() {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('mousedown', onMouseDown)
  currentId = null; bindings = []; recordingAction = null
}

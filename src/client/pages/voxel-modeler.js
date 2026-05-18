import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { Brush, Evaluator, ADDITION, SUBTRACTION, INTERSECTION } from 'three-bvh-csg'
import { initScene, resize as engineResize } from '../../engine/scene.js'
import { createGrid } from '../../engine/grid.js'

let currentId = null
let scene, camera, renderer, orbitControls, transformControls
let primitives = []
let selectedId = null
let ghostId = null
let transformMode = 'translate'
let animFrameId = null
let containerEl = null
let raycaster = new THREE.Raycaster()
let mouse = new THREE.Vector2()
let _bbox = new THREE.Box3()
let mouseDownPos = null
let isDragging = false
let dragStartMouse = new THREE.Vector2()
let dragStartPos = new THREE.Vector3()
let dragStartScale = new THREE.Vector3()
let dragStartRot = new THREE.Euler()
let dragAxis = null
let dragPlane = new THREE.Plane()
let dragPlaneIntersect = new THREE.Vector3()
let hudEl = null
let compassCanvas = null
let materialList = []

const MODE_NAMES = { translate: 'Mover', rotate: 'Rotar', scale: 'Escalar' }
const MODE_KEYS = { translate: 'M', rotate: 'Tab', scale: 'G' }

const BASE_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.6, metalness: 0.1 })
const GHOST_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x44aa88, transparent: true, opacity: 0.35, depthWrite: false })
const GHOST_EDGE = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1))
const GHOST_LINE = new THREE.LineBasicMaterial({ color: 0x44aa88, transparent: true, opacity: 0.6 })
const SELECTED_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x44aa88, roughness: 0.3, metalness: 0.3, emissive: 0x44aa88, emissiveIntensity: 0.15 })

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 11)
}

function createPrimitiveGeometry(type, params = {}) {
  switch (type) {
    case 'box':
      return new THREE.BoxGeometry(params.width || 1, params.height || 1, params.depth || 1)
    case 'sphere':
      return new THREE.SphereGeometry(params.radius || 0.5, params.segments || 16, params.segments || 16)
    case 'cylinder':
      return new THREE.CylinderGeometry(params.radiusTop || 0.5, params.radiusBottom || 0.5, params.height || 1, params.segments || 16)
    case 'cone':
      return new THREE.ConeGeometry(params.radius || 0.5, params.height || 1, params.segments || 16)
    case 'torus':
      return new THREE.TorusGeometry(params.radius || 0.5, params.tube || 0.2, params.radialSegments || 12, params.tubularSegments || 24)
    case 'plane':
      return new THREE.PlaneGeometry(params.width || 1, params.height || 1)
    default:
      return new THREE.BoxGeometry(1, 1, 1)
  }
}

function computeBottomOffset(mesh) {
  _bbox.setFromObject(mesh)
  return -_bbox.min.y
}

function addPrimitive(type, params = {}) {
  if (ghostId) confirmGhost()
  ghostId = uuid()
  const geometry = createPrimitiveGeometry(type, params)
  const mesh = new THREE.Mesh(geometry, GHOST_MATERIAL.clone())
  mesh.userData.primitiveId = ghostId
  mesh.userData.type = type
  scene.add(mesh)
  const offset = computeBottomOffset(mesh)
  mesh.position.y = offset

  const edges = new THREE.EdgesGeometry(geometry)
  const line = new THREE.LineSegments(edges, GHOST_LINE.clone())
  mesh.add(line)

  const prim = { id: ghostId, type, mesh, params: { ...params }, ghost: true, bottomOffset: offset }
  primitives.push(prim)
  selectedId = ghostId
  transformControls.attach(mesh)
  updateSelection()
  renderPrimitiveList()
  renderPrimitiveEditor()
}

function confirmGhost() {
  if (!ghostId) {
    if (transformControls && transformControls.object) {
      transformControls.detach()
    }
    return
  }
  const prim = primitives.find(p => p.id === ghostId)
  if (!prim) { ghostId = null; return }
  prim.ghost = false
  while (prim.mesh.children.length) {
    prim.mesh.remove(prim.mesh.children[0])
  }
  prim.mesh.material = BASE_MATERIAL.clone()
  prim.mesh.material.color.setHex(0x999999)
  prim.bottomOffset = computeBottomOffset(prim.mesh)
  prim.mesh.position.y = prim.bottomOffset
  ghostId = null
  transformControls.detach()
  updateSelection()
  renderPrimitiveList()
  renderPrimitiveEditor()
}

function cancelGhost() {
  if (!ghostId) return
  const idx = primitives.findIndex(p => p.id === ghostId)
  if (idx !== -1) {
    scene.remove(primitives[idx].mesh)
    primitives[idx].mesh.geometry.dispose()
    primitives.splice(idx, 1)
  }
  ghostId = null
  selectedId = null
  transformControls.detach()
  updateSelection()
  renderPrimitiveList()
}

function deleteSelected() {
  if (!selectedId) return
  const idx = primitives.findIndex(p => p.id === selectedId)
  if (idx === -1) return
  const wasGhost = primitives[idx].ghost
  scene.remove(primitives[idx].mesh)
  primitives[idx].mesh.geometry.dispose()
  primitives.splice(idx, 1)
  selectedId = null
  if (wasGhost) ghostId = null
  transformControls.detach()
  updateSelection()
  renderPrimitiveList()
  renderPrimitiveEditor()
}

function cloneSelected() {
  if (!selectedId) return
  const src = primitives.find(p => p.id === selectedId)
  if (!src || src.ghost) return
  const newId = uuid()
  const geometry = createPrimitiveGeometry(src.type, src.params)
  const mesh = new THREE.Mesh(geometry, BASE_MATERIAL.clone())
  mesh.position.copy(src.mesh.position)
  mesh.position.x += 1
  mesh.rotation.copy(src.mesh.rotation)
  mesh.scale.copy(src.mesh.scale)
  mesh.userData.primitiveId = newId
  mesh.userData.type = src.type
  scene.add(mesh)
  const offset = computeBottomOffset(mesh)
  const prim = { id: newId, type: src.type, mesh, params: { ...src.params }, ghost: false, bottomOffset: offset }
  primitives.push(prim)
  selectedId = newId
  transformControls.attach(mesh)
  updateSelection()
  renderPrimitiveList()
  renderPrimitiveEditor()
}

function selectPrimitive(id) {
  if (selectedId === id) return
  selectedId = id
  if (id) {
    const prim = primitives.find(p => p.id === id)
    if (prim) {
      transformControls.attach(prim.mesh)
    }
  } else {
    transformControls.detach()
  }
  updateSelection()
  renderPrimitiveList()
  renderPrimitiveEditor()
}

function updateSelection() {
  primitives.forEach(p => {
    if (p.ghost) return
    if (p.id === selectedId) {
      if (!p.mesh.material || p.mesh.material !== SELECTED_MATERIAL) {
        p.mesh.material = SELECTED_MATERIAL.clone()
      }
    } else {
      p.mesh.material = BASE_MATERIAL.clone()
    }
  })
}

function getPrimitiveData(prim) {
  return {
    id: prim.id,
    type: prim.type,
    position: [prim.mesh.position.x, prim.mesh.position.y, prim.mesh.position.z],
    rotation: [prim.mesh.rotation.x, prim.mesh.rotation.y, prim.mesh.rotation.z],
    scale: [prim.mesh.scale.x, prim.mesh.scale.y, prim.mesh.scale.z],
    params: { ...prim.params },
    materialId: prim.materialId || null,
  }
}

function getNDC(e) {
  const rect = renderer.domElement.getBoundingClientRect()
  return new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  )
}

function intersectDragPlane(ndc, target) {
  raycaster.setFromCamera(ndc, camera)
  return raycaster.ray.intersectPlane(dragPlane, target)
}

function projectDeltaOnAxis(delta, axis) {
  const dir = new THREE.Vector3(
    axis === 'X' ? 1 : 0,
    axis === 'Y' ? 1 : 0,
    axis === 'Z' ? 1 : 0
  )
  return dir.multiplyScalar(delta.dot(dir))
}

function onMouseDown(e) {
  mouseDownPos = { x: e.clientX, y: e.clientY }
  dragStartMouse.set(e.clientX, e.clientY)

  const ndc = getNDC(e)
  raycaster.setFromCamera(ndc, camera)

  const meshes = primitives.map(p => p.mesh)
  const intersects = raycaster.intersectObjects(meshes, true)
  if (intersects.length > 0) {
    let hitObj = intersects[0].object
    while (hitObj.parent && !primitives.find(p => p.mesh === hitObj)) {
      hitObj = hitObj.parent
    }
    const prim = primitives.find(p => p.mesh === hitObj)
    if (prim && !prim.ghost) {
      if (selectedId !== prim.id) selectPrimitive(prim.id)
      return
    }
  }

  selectPrimitive(null)
}

function onMouseMove(e) {
  if (!mouseDownPos) return
  const dx = e.clientX - mouseDownPos.x
  const dy = e.clientY - mouseDownPos.y
  if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return
  if (!isDragging && selectedId) {
    const prim = primitives.find(p => p.id === selectedId)
    if (!prim || prim.ghost) { isDragging = false; return }
    isDragging = true
    dragStartPos.copy(prim.mesh.position)
    dragStartScale.copy(prim.mesh.scale)
    dragStartRot.copy(prim.mesh.rotation)
    orbitControls.enabled = false

    if (transformMode === 'translate') {
      const forward = new THREE.Vector3()
      camera.getWorldDirection(forward)
      dragPlane.setFromNormalAndCoplanarPoint(forward, dragStartPos)
      intersectDragPlane(getNDC(e), dragPlaneIntersect)
      prim.bottomOffset = computeBottomOffset(prim.mesh)
    }
  }
  if (!isDragging) return

  const prim = primitives.find(p => p.id === selectedId)
  if (!prim) return

  const mdx = e.clientX - dragStartMouse.x
  const mdy = e.clientY - dragStartMouse.y

  if (transformMode === 'translate') {
    const current = new THREE.Vector3()
    if (!intersectDragPlane(getNDC(e), current)) return
    const delta = current.sub(dragPlaneIntersect)
    if (dragAxis) {
      delta.copy(projectDeltaOnAxis(delta, dragAxis))
    }
    prim.mesh.position.copy(dragStartPos).add(delta)
    if (prim.mesh.position.y < (prim.bottomOffset || 0)) prim.mesh.position.y = (prim.bottomOffset || 0)
  } else if (transformMode === 'scale') {
    const factor = 1 + (mdx + mdy) * 0.005
    if (dragAxis === 'X') {
      prim.mesh.scale.x = Math.max(0.01, dragStartScale.x * factor)
    } else if (dragAxis === 'Y') {
      prim.mesh.scale.y = Math.max(0.01, dragStartScale.y * factor)
    } else if (dragAxis === 'Z') {
      prim.mesh.scale.z = Math.max(0.01, dragStartScale.z * factor)
    } else {
      const s = Math.max(0.01, dragStartScale.x * factor)
      prim.mesh.scale.set(s, s, s)
    }
  } else if (transformMode === 'rotate') {
    const angle = (mdx + mdy) * 0.008
    if (dragAxis === 'X') {
      prim.mesh.rotation.x = dragStartRot.x + angle
    } else if (dragAxis === 'Y') {
      prim.mesh.rotation.y = dragStartRot.y + angle
    } else if (dragAxis === 'Z') {
      prim.mesh.rotation.z = dragStartRot.z + angle
    } else {
      prim.mesh.rotation.y = dragStartRot.y + angle
    }
  }

  syncEditorInputs(prim)
}

function onMouseUp(e) {
  if (isDragging) {
    isDragging = false
    mouseDownPos = null
    orbitControls.enabled = true
    return
  }
  mouseDownPos = null
}

function initCompass() {
  const div = document.createElement('div')
  div.id = 'vm-compass'
  div.style.cssText = 'position:absolute;bottom:8px;right:8px;width:80px;height:80px;z-index:10;pointer-events:none'
  const canvas = document.createElement('canvas')
  canvas.width = 80
  canvas.height = 80
  div.appendChild(canvas)
  containerEl.appendChild(div)
  compassCanvas = canvas
}

function updateCompass() {
  if (!compassCanvas || !camera) return
  const ctx = compassCanvas.getContext('2d')
  const w = 80, h = 80, cx = 40, cy = 40
  ctx.clearRect(0, 0, w, h)

  const e = camera.matrixWorldInverse.elements
  const axes = [
    { dx: e[0], dy: -e[4], color: '#ff4444', label: 'X' },
    { dx: e[1], dy: -e[5], color: '#44ff44', label: 'Y' },
    { dx: e[2], dy: -e[6], color: '#4488ff', label: 'Z' },
  ]

  const len = 28
  axes.forEach(a => {
    const mag = Math.sqrt(a.dx * a.dx + a.dy * a.dy) || 0.001
    const nx = a.dx / mag, ny = a.dy / mag
    const endX = cx + nx * len
    const endY = cy + ny * len

    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(endX, endY)
    ctx.strokeStyle = a.color
    ctx.lineWidth = 2.5
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(endX - nx * 3, endY - ny * 3, 4, 0, Math.PI * 2)
    ctx.fillStyle = a.color
    ctx.fill()

    ctx.fillStyle = a.color
    ctx.font = 'bold 10px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const lx = endX + nx * 10
    const ly = endY + ny * 10
    ctx.fillText(a.label, lx, ly)
  })
}

function initEditorScene(container) {
  containerEl = container

  const eng = initScene(container)
  scene = eng.scene
  renderer = eng.renderer
  scene.background = new THREE.Color(0x3a3a3a)

  camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100)
  camera.position.set(5, 5, 5)

  orbitControls = new OrbitControls(camera, renderer.domElement)
  orbitControls.enableDamping = true
  orbitControls.dampingFactor = 0.1
  orbitControls.target.set(0, 0, 0)

  transformControls = new TransformControls(camera, renderer.domElement)
  transformControls.setSize(1.5)
  transformControls.enabled = false
  scene.add(transformControls)

  createGrid(scene)

  initCompass()

  renderer.domElement.addEventListener('mousedown', onMouseDown)
  renderer.domElement.addEventListener('mousemove', onMouseMove)
  renderer.domElement.addEventListener('mouseup', onMouseUp)

  animate()
}

function animate() {
  animFrameId = requestAnimationFrame(animate)
  orbitControls.update()
  updateCompass()
  renderer.render(scene, camera)
}

function resize() {
  if (!containerEl || !renderer) return
  const w = containerEl.clientWidth
  const h = containerEl.clientHeight
  if (w === 0 || h === 0) return
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  engineResize()
}

function updateHUD() {
  if (!hudEl) return
  const modes = ['translate', 'rotate', 'scale']
  const modeHtml = modes.map(m => {
    const active = m === transformMode ? 'active' : ''
    return `<span class="vm-hud-mode ${active}" data-mode="${m}">${MODE_NAMES[m]} (<kbd>${MODE_KEYS[m]}</kbd>)</span>`
  }).join('')
  const axisHtml = dragAxis ? ` <span class="vm-hud-axis">Eje: ${dragAxis}</span>` : ''
  hudEl.innerHTML = modeHtml + axisHtml
}

function csgOperation(operation) {
  const selected = primitives.filter(p => p.id === selectedId || p.id === getSecondSelected())
  if (selected.length !== 2) {
    alert('Seleccioná exactamente 2 primitivas para la operación')
    return
  }

  try {
    const [a, b] = selected
    const brushA = new Brush(a.mesh.geometry, a.mesh.matrixWorld)
    const brushB = new Brush(b.mesh.geometry, b.mesh.matrixWorld)
    const evaluator = new Evaluator()
    const result = evaluator.evaluate(brushA, brushB, operation)

    result.material = BASE_MATERIAL.clone()
    result.userData.primitiveId = uuid()
    result.userData.type = 'csg'
    scene.add(result)

    const newPrim = {
      id: result.userData.primitiveId,
      type: 'csg',
      mesh: result,
      params: { operation, sourceIds: [a.id, b.id] },
      ghost: false,
      bottomOffset: computeBottomOffset(result),
    }

    const toRemove = [a, b]
    toRemove.forEach(p => {
      scene.remove(p.mesh)
      p.mesh.geometry.dispose()
    })
    primitives = primitives.filter(p => !toRemove.includes(p))
    primitives.push(newPrim)
    selectedId = newPrim.id
    transformControls.attach(result)
    updateSelection()
    renderPrimitiveList()
  } catch (err) {
    alert('Error en operación CSG: ' + err.message)
  }
}

function getSecondSelected() {
  return document.querySelector('.vm-prim-item.selected-secondary')?.dataset?.primId || null
}

function handleKeyDown(e) {
  const key = e.key
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return

  if (key === 'g' || key === 'G') {
    transformMode = 'scale'
    dragAxis = null
    transformControls.setMode('scale')
    updateHUD()
    e.preventDefault()
  } else if (key === 'm' || key === 'M') {
    transformMode = 'translate'
    dragAxis = null
    transformControls.setMode('translate')
    updateHUD()
    e.preventDefault()
  } else if (key === 'Tab') {
    e.preventDefault()
    const modes = ['translate', 'rotate', 'scale']
    const idx = modes.indexOf(transformMode)
    transformMode = modes[(idx + 1) % modes.length]
    dragAxis = null
    transformControls.setMode(transformMode)
    updateHUD()
  } else if (key === 'x' || key === 'X') {
    e.preventDefault()
    dragAxis = dragAxis === 'X' ? null : 'X'
  } else if (key === 'y' || key === 'Y') {
    e.preventDefault()
    dragAxis = dragAxis === 'Y' ? null : 'Y'
  } else if (key === 'z' || key === 'Z') {
    e.preventDefault()
    dragAxis = dragAxis === 'Z' ? null : 'Z'
  } else if (key === 'Enter') {
    e.preventDefault()
    confirmGhost()
  } else if (key === 'Escape') {
    e.preventDefault()
    cancelGhost()
  } else if (key === 'Delete' || key === 'Backspace') {
    deleteSelected()
  } else if (key === 'd' || key === 'D') {
    e.preventDefault()
    cloneSelected()
  }
}

function initShortcuts() {
  window.addEventListener('keydown', handleKeyDown)
}

function destroyShortcuts() {
  window.removeEventListener('keydown', handleKeyDown)
}

export function renderVoxelModeler() {
  const app = document.getElementById('app')
  app.innerHTML = `
    <div class="tool-header">
      <h1>Voxel Modeler</h1>
      <button id="vm-new" class="btn-primary">+ Nuevo</button>
    </div>
    <div class="tool-layout">
      <div id="vm-list" class="tool-panel"></div>
      <div id="vm-canvas-container" class="tool-viewport"></div>
      <div id="vm-props" class="tool-props"></div>
    </div>
  `

  const container = document.getElementById('vm-canvas-container')
  initEditorScene(container)
  initShortcuts()

  const hud = document.createElement('div')
  hud.id = 'vm-hud'
  hud.style.cssText = 'position:absolute;top:8px;left:8px;display:flex;gap:4px;z-index:10'
  container.appendChild(hud)
  hudEl = hud
  updateHUD()

  const ro = new ResizeObserver(() => resize())
  ro.observe(container)
  renderer._resizeObserver = ro

  document.getElementById('vm-new').addEventListener('click', () => newModel())
  loadList()
  loadMaterials()
}

function newModel() {
  if (currentId) cleanupScene()
  currentId = null
  primitives = []
  selectedId = null
  ghostId = null
  if (transformControls) transformControls.detach()
  renderPrimitiveList()
  renderProps({ name: '' })
}

function cleanupScene() {
  primitives.forEach(p => {
    scene.remove(p.mesh)
    p.mesh.geometry.dispose()
  })
  primitives = []
  selectedId = null
  ghostId = null
}

function loadList() {
  fetch('/api/resources/models')
    .then(r => r.json())
    .then(list => renderList(list))
    .catch(() => renderList([]))
}

function renderList(list) {
  const el = document.getElementById('vm-list')
  el.innerHTML = list.length === 0
    ? '<p style="color:#666;font-size:13px;padding:8px">Sin modelos aún.</p>'
    : list.map(t => `
      <div class="vm-list-item" data-id="${t.id}" style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:6px;cursor:pointer"
           onmouseenter="this.style.background='#2a2a2a'" onmouseleave="this.style.background='transparent'">
        <span style="font-size:13px;flex:1">${escapeHtml(t.name)}</span>
        <button class="btn-delete" data-id="${t.id}" style="background:none;border:none;color:#cc4444;cursor:pointer;font-size:14px;padding:0 4px" title="Eliminar">×</button>
      </div>
    `).join('')

  el.querySelectorAll('.vm-list-item').forEach(item => {
    item.addEventListener('click', e => {
      if (e.target.tagName === 'BUTTON') return
      loadModel(item.dataset.id)
    })
  })

  const matSelect = document.getElementById('vm-material')
  if (matSelect) {
    matSelect.addEventListener('change', () => {
      const prim = primitives.find(p => p.id === selectedId)
      if (prim) applyMaterialToMesh(prim, matSelect.value)
      updateSelection()
    })
  }
}

function loadModel(id) {
  cleanupScene()
  fetch(`/api/resources/models/${id}`)
    .then(r => r.json())
    .then(data => {
      currentId = data.id
      data.primitives.forEach(pd => {
        const geometry = createPrimitiveGeometry(pd.type, pd.params)
        const mesh = new THREE.Mesh(geometry, BASE_MATERIAL.clone())
        mesh.position.set(pd.position[0], pd.position[1], pd.position[2])
        mesh.rotation.set(pd.rotation[0], pd.rotation[1], pd.rotation[2])
        mesh.scale.set(pd.scale[0], pd.scale[1], pd.scale[2])
        mesh.userData.primitiveId = pd.id
        mesh.userData.type = pd.type
        scene.add(mesh)
        const offset = computeBottomOffset(mesh)
        const prim = { id: pd.id, type: pd.type, mesh, params: { ...pd.params }, ghost: false, bottomOffset: offset }
        if (pd.materialId) applyMaterialToMesh(prim, pd.materialId)
        primitives.push(prim)
      })
      selectedId = null
      ghostId = null
      updateSelection()
      renderPrimitiveList()
      renderProps(data)
    })
    .catch(() => alert('Error al cargar modelo'))
}

function saveModel() {
  const name = document.getElementById('vm-name')?.value
  if (!name || !name.trim()) {
    alert('El nombre es obligatorio')
    return
  }

  confirmGhost()

  const data = {
    name: name.trim(),
    primitives: primitives.map(getPrimitiveData),
  }

  const method = currentId ? 'PUT' : 'POST'
  const url = currentId
    ? `/api/resources/models/${currentId}`
    : '/api/resources/models'

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

function deleteModel(id) {
  fetch(`/api/resources/models/${id}`, { method: 'DELETE' })
    .then(() => {
      if (currentId === id) {
        currentId = null
        cleanupScene()
        renderProps(null)
      }
      loadList()
    })
    .catch(() => alert('Error al eliminar'))
}

function loadMaterials() {
  fetch('/api/resources/materials')
    .then(r => r.json())
    .then(list => { materialList = list })
    .catch(() => {})
}

function updatePrimitiveTransform(id) {
  const prim = primitives.find(p => p.id === id)
  if (!prim) return
  const el = document.getElementById('vm-prim-editor')
  if (!el) return
  const get = (name, fallback) => {
    const v = parseFloat(el.querySelector(`[data-pf="${name}"]`)?.value)
    return isNaN(v) ? fallback : v
  }
  const minY = (prim.bottomOffset || 0)
  prim.mesh.position.set(get('px', 0), Math.max(minY, get('py', 0)), get('pz', 0))
  const rx = get('rx', 0) * Math.PI / 180
  const ry = get('ry', 0) * Math.PI / 180
  const rz = get('rz', 0) * Math.PI / 180
  prim.mesh.rotation.set(rx, ry, rz)
  prim.mesh.scale.set(get('sx', 1), get('sy', 1), get('sz', 1))
}

function updatePrimitiveParams(id) {
  const prim = primitives.find(p => p.id === id)
  if (!prim) return
  const el = document.getElementById('vm-prim-editor')
  if (!el) return
  const inputs = el.querySelectorAll('[data-pf]')
  inputs.forEach(inp => {
    const pf = inp.dataset.pf
    if (pf.startsWith('pp-')) {
      const key = pf.slice(3)
      prim.params[key] = parseFloat(inp.value) || 0
    }
  })
  const geom = createPrimitiveGeometry(prim.type, prim.params)
  prim.mesh.geometry.dispose()
  prim.mesh.geometry = geom
  // update edge lines for ghost objects
  while (prim.mesh.children.length) prim.mesh.remove(prim.mesh.children[0])
  if (prim.ghost) {
    const edges = new THREE.EdgesGeometry(geom)
    const line = new THREE.LineSegments(edges, GHOST_LINE.clone())
    prim.mesh.add(line)
  }
  prim.bottomOffset = computeBottomOffset(prim.mesh)
  const minY = (prim.bottomOffset || 0)
  if (prim.mesh.position.y < minY) prim.mesh.position.y = minY
}

function syncEditorInputs(prim) {
  const el = document.getElementById('vm-prim-editor')
  if (!el) return
  const set = (name, v) => {
    const inp = el.querySelector(`[data-pf="${name}"]`)
    if (inp) inp.value = round(v)
  }
  set('px', prim.mesh.position.x)
  set('py', prim.mesh.position.y)
  set('pz', prim.mesh.position.z)
  const toDeg = v => round(v * 180 / Math.PI)
  set('rx', toDeg(prim.mesh.rotation.x))
  set('ry', toDeg(prim.mesh.rotation.y))
  set('rz', toDeg(prim.mesh.rotation.z))
  set('sx', prim.mesh.scale.x)
  set('sy', prim.mesh.scale.y)
  set('sz', prim.mesh.scale.z)
}

function applyMaterialToMesh(prim, materialId) {
  prim.materialId = materialId || null
  if (!prim.materialId) {
    prim.mesh.material = BASE_MATERIAL.clone()
    return
  }
  const mat = materialList.find(m => m.id === prim.materialId)
  if (!mat) {
    prim.mesh.material = BASE_MATERIAL.clone()
    return
  }
  prim.mesh.material = new THREE.MeshStandardMaterial({
    color: mat.color || '#999999',
    roughness: mat.roughness ?? 0.6,
    metalness: mat.metalness ?? 0.1,
    emissive: mat.emissiveColor || '#000000',
    emissiveIntensity: mat.emissiveIntensity || 0,
    transparent: (mat.opacity ?? 1) < 1,
    opacity: mat.opacity ?? 1,
  })
}

function renderPrimitiveEditor() {
  const container = document.getElementById('vm-prim-editor')
  if (!container) return
  const prim = primitives.find(p => p.id === selectedId)
  if (!prim) {
    container.innerHTML = ''
    return
  }
  const p = prim.mesh.position
  const r = prim.mesh.rotation
  const s = prim.mesh.scale

  const paramFields = getParamFields(prim.type, prim.params)
  const toDeg = v => Math.round(v * 180 / Math.PI * 100) / 100

  container.innerHTML = `
    <hr style="border:none;border-top:1px solid #2a2a2a;margin:12px 0">

    <div style="font-size:12px;font-weight:600;color:#44aa88;margin-bottom:8px">TRANSFORMAR</div>

    <div style="font-size:11px;color:#888;margin-bottom:4px">Posición</div>
    <div style="display:flex;gap:4px;margin-bottom:6px">
      <input data-pf="px" type="number" step="0.1" value="${round(p.x)}" style="flex:1;width:0;background:#222;color:#ddd;border:1px solid #444;border-radius:4px;padding:3px 5px;font-size:11px">
      <input data-pf="py" type="number" step="0.1" value="${round(p.y)}" style="flex:1;width:0;background:#222;color:#ddd;border:1px solid #444;border-radius:4px;padding:3px 5px;font-size:11px">
      <input data-pf="pz" type="number" step="0.1" value="${round(p.z)}" style="flex:1;width:0;background:#222;color:#ddd;border:1px solid #444;border-radius:4px;padding:3px 5px;font-size:11px">
    </div>

    <div style="font-size:11px;color:#888;margin-bottom:4px">Rotación °</div>
    <div style="display:flex;gap:4px;margin-bottom:6px">
      <input data-pf="rx" type="number" step="1" value="${toDeg(r.x)}" style="flex:1;width:0;background:#222;color:#ddd;border:1px solid #444;border-radius:4px;padding:3px 5px;font-size:11px">
      <input data-pf="ry" type="number" step="1" value="${toDeg(r.y)}" style="flex:1;width:0;background:#222;color:#ddd;border:1px solid #444;border-radius:4px;padding:3px 5px;font-size:11px">
      <input data-pf="rz" type="number" step="1" value="${toDeg(r.z)}" style="flex:1;width:0;background:#222;color:#ddd;border:1px solid #444;border-radius:4px;padding:3px 5px;font-size:11px">
    </div>

    <div style="font-size:11px;color:#888;margin-bottom:4px">Escala</div>
    <div style="display:flex;gap:4px;margin-bottom:6px">
      <input data-pf="sx" type="number" step="0.1" min="0.01" value="${round(s.x)}" style="flex:1;width:0;background:#222;color:#ddd;border:1px solid #444;border-radius:4px;padding:3px 5px;font-size:11px">
      <input data-pf="sy" type="number" step="0.1" min="0.01" value="${round(s.y)}" style="flex:1;width:0;background:#222;color:#ddd;border:1px solid #444;border-radius:4px;padding:3px 5px;font-size:11px">
      <input data-pf="sz" type="number" step="0.1" min="0.01" value="${round(s.z)}" style="flex:1;width:0;background:#222;color:#ddd;border:1px solid #444;border-radius:4px;padding:3px 5px;font-size:11px">
    </div>

    ${paramFields.length > 0 ? `
    <hr style="border:none;border-top:1px solid #2a2a2a;margin:12px 0">
    <div style="font-size:12px;font-weight:600;color:#44aa88;margin-bottom:8px">MEDIDAS</div>
    <div style="display:flex;gap:4px;margin-bottom:6px;flex-wrap:wrap">
      ${paramFields.map(f => `
        <div style="flex:1;min-width:60px">
          <div style="font-size:10px;color:#666;margin-bottom:2px">${f.label}</div>
          <input data-pf="pp-${f.key}" type="number" step="${f.step || 0.1}" min="${f.min ?? 0}" value="${f.value}" style="width:100%;background:#222;color:#ddd;border:1px solid #444;border-radius:4px;padding:3px 5px;font-size:11px">
        </div>
      `).join('')}
    </div>
    ` : ''}

    <hr style="border:none;border-top:1px solid #2a2a2a;margin:12px 0">
    <div style="font-size:12px;font-weight:600;color:#44aa88;margin-bottom:8px">MATERIAL</div>
    <select id="vm-material" style="width:100%;background:#222;color:#ddd;border:1px solid #444;border-radius:4px;padding:4px 6px;font-size:12px">
      <option value="">— Sin material —</option>
      ${materialList.map(m => `<option value="${m.id}"${m.id === prim.materialId ? ' selected' : ''}>${escapeHtml(m.name)}</option>`).join('')}
    </select>
  `

  const inputs = container.querySelectorAll('input[data-pf]')
  inputs.forEach(inp => {
    inp.addEventListener('input', () => {
      const pf = inp.dataset.pf
      if (pf.startsWith('pp-')) {
        updatePrimitiveParams(selectedId)
      } else {
        updatePrimitiveTransform(selectedId)
      }
    })
  })
}

function getParamFields(type, params) {
  switch (type) {
    case 'box':
      return [
        { key: 'width', label: 'Ancho', value: params.width || 1, step: 0.1, min: 0.01 },
        { key: 'height', label: 'Alto', value: params.height || 1, step: 0.1, min: 0.01 },
        { key: 'depth', label: 'Fondo', value: params.depth || 1, step: 0.1, min: 0.01 },
      ]
    case 'sphere':
      return [
        { key: 'radius', label: 'Radio', value: params.radius || 0.5, step: 0.1, min: 0.01 },
        { key: 'segments', label: 'Segmentos', value: params.segments || 16, step: 1, min: 3 },
      ]
    case 'cylinder':
      return [
        { key: 'radiusTop', label: 'Radio sup', value: params.radiusTop || 0.5, step: 0.1, min: 0 },
        { key: 'radiusBottom', label: 'Radio inf', value: params.radiusBottom || 0.5, step: 0.1, min: 0 },
        { key: 'height', label: 'Alto', value: params.height || 1, step: 0.1, min: 0.01 },
        { key: 'segments', label: 'Segmentos', value: params.segments || 16, step: 1, min: 3 },
      ]
    case 'cone':
      return [
        { key: 'radius', label: 'Radio', value: params.radius || 0.5, step: 0.1, min: 0.01 },
        { key: 'height', label: 'Alto', value: params.height || 1, step: 0.1, min: 0.01 },
        { key: 'segments', label: 'Segmentos', value: params.segments || 16, step: 1, min: 3 },
      ]
    case 'torus':
      return [
        { key: 'radius', label: 'Radio', value: params.radius || 0.5, step: 0.1, min: 0.01 },
        { key: 'tube', label: 'Tubo', value: params.tube || 0.2, step: 0.1, min: 0.01 },
        { key: 'radialSegments', label: 'Seg radiales', value: params.radialSegments || 12, step: 1, min: 3 },
        { key: 'tubularSegments', label: 'Seg tubulares', value: params.tubularSegments || 24, step: 1, min: 3 },
      ]
    case 'plane':
      return [
        { key: 'width', label: 'Ancho', value: params.width || 1, step: 0.1, min: 0.01 },
        { key: 'height', label: 'Alto', value: params.height || 1, step: 0.1, min: 0.01 },
      ]
    default:
      return []
  }
}

function round(v) { return Math.round(v * 100) / 100 }

function renderProps(t) {
  const el = document.getElementById('vm-props')
  if (!t) {
    el.innerHTML = '<p style="color:#666;font-size:13px">Seleccioná o creá un modelo para editar.</p>'
    return
  }
  el.innerHTML = `
    <div style="font-size:12px;font-weight:600;color:#44aa88;margin-bottom:8px">PROPIEDADES</div>

    <label style="display:block;font-size:12px;color:#888;margin-bottom:4px">Nombre</label>
    <input id="vm-name" type="text" value="${escapeHtml(t.name || '')}" style="width:100%;margin-bottom:12px;background:#222;color:#ddd;border:1px solid #444;border-radius:6px;padding:6px 10px;font-size:13px">

    <hr style="border:none;border-top:1px solid #2a2a2a;margin:12px 0">

    <div style="font-size:12px;font-weight:600;color:#44aa88;margin-bottom:8px">PRIMITIVAS</div>

    <div style="display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap">
      <button class="vm-add-prim" data-type="box" style="padding:5px 8px;border-radius:4px;border:1px solid #444;background:#222;color:#ddd;cursor:pointer;font-size:11px">Cubo</button>
      <button class="vm-add-prim" data-type="sphere" style="padding:5px 8px;border-radius:4px;border:1px solid #444;background:#222;color:#ddd;cursor:pointer;font-size:11px">Esfera</button>
      <button class="vm-add-prim" data-type="cylinder" style="padding:5px 8px;border-radius:4px;border:1px solid #444;background:#222;color:#ddd;cursor:pointer;font-size:11px">Cilindro</button>
      <button class="vm-add-prim" data-type="cone" style="padding:5px 8px;border-radius:4px;border:1px solid #444;background:#222;color:#ddd;cursor:pointer;font-size:11px">Cono</button>
      <button class="vm-add-prim" data-type="torus" style="padding:5px 8px;border-radius:4px;border:1px solid #444;background:#222;color:#ddd;cursor:pointer;font-size:11px">Toro</button>
      <button class="vm-add-prim" data-type="plane" style="padding:5px 8px;border-radius:4px;border:1px solid #444;background:#222;color:#ddd;cursor:pointer;font-size:11px">Plano</button>
    </div>

    <div id="vm-prim-list" style="margin-bottom:12px"></div>
    <div id="vm-prim-editor"></div>

    <hr style="border:none;border-top:1px solid #2a2a2a;margin:12px 0">

    <div style="font-size:12px;font-weight:600;color:#44aa88;margin-bottom:8px">BOOLEANAS</div>
    <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
      <button id="vm-csg-union" style="padding:5px 8px;border-radius:4px;border:1px solid #444;background:#222;color:#ddd;cursor:pointer;font-size:11px">Fusionar</button>
      <button id="vm-csg-sub" style="padding:5px 8px;border-radius:4px;border:1px solid #444;background:#222;color:#ddd;cursor:pointer;font-size:11px">Cortar</button>
      <button id="vm-csg-intersect" style="padding:5px 8px;border-radius:4px;border:1px solid #444;background:#222;color:#ddd;cursor:pointer;font-size:11px">Intersectar</button>
    </div>

    <hr style="border:none;border-top:1px solid #2a2a2a;margin:12px 0">

    <div style="font-size:11px;color:#666;margin-bottom:12px">
      <div><kbd style="background:#333;padding:1px 5px;border-radius:3px;font-size:10px">G</kbd> Escalar · <kbd style="background:#333;padding:1px 5px;border-radius:3px;font-size:10px">M</kbd> Mover · <kbd style="background:#333;padding:1px 5px;border-radius:3px;font-size:10px">Tab</kbd> Rotar</div>
      <div style="margin-top:4px"><kbd style="background:#333;padding:1px 5px;border-radius:3px;font-size:10px">X</kbd><kbd style="background:#333;padding:1px 5px;border-radius:3px;font-size:10px">Y</kbd><kbd style="background:#333;padding:1px 5px;border-radius:3px;font-size:10px">Z</kbd> Eje · <kbd style="background:#333;padding:1px 5px;border-radius:3px;font-size:10px">Enter</kbd> Fijar · <kbd style="background:#333;padding:1px 5px;border-radius:3px;font-size:10px">Esc</kbd> Cancelar · <kbd style="background:#333;padding:1px 5px;border-radius:3px;font-size:10px">Supr</kbd> Eliminar · <kbd style="background:#333;padding:1px 5px;border-radius:3px;font-size:10px">D</kbd> Clonar</div>
    </div>

    <div style="display:flex;gap:8px">
      <button id="vm-save" class="btn-primary" style="flex:1">Guardar</button>
      <button id="vm-delete" class="btn-danger" ${!currentId ? 'disabled style="opacity:0.4"' : ''}>Eliminar</button>
    </div>
  `

  el.querySelectorAll('.vm-add-prim').forEach(btn => {
    btn.addEventListener('click', () => addPrimitive(btn.dataset.type))
  })
  el.querySelector('#vm-csg-union').addEventListener('click', () => csgOperation(ADDITION))
  el.querySelector('#vm-csg-sub').addEventListener('click', () => csgOperation(SUBTRACTION))
  el.querySelector('#vm-csg-intersect').addEventListener('click', () => csgOperation(INTERSECTION))
  el.querySelector('#vm-save').addEventListener('click', saveModel)
  if (currentId) {
    el.querySelector('#vm-delete').addEventListener('click', () => {
      if (confirm('¿Eliminar este modelo?')) deleteModel(currentId)
    })
  }

  renderPrimitiveList()
  renderPrimitiveEditor()
}

function renderPrimitiveList() {
  const el = document.getElementById('vm-prim-list')
  if (!el) return
  if (primitives.length === 0) {
    el.innerHTML = '<p style="color:#666;font-size:12px">Sin primitivas.</p>'
    return
  }
  el.innerHTML = primitives.map(p => {
    const label = p.type.charAt(0).toUpperCase() + p.type.slice(1) + (p.ghost ? ' (fantasma)' : '')
    const sel = p.id === selectedId ? 'selected' : ''
    return `<div class="vm-prim-item ${sel}" data-prim-id="${p.id}" style="display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:4px;cursor:pointer;font-size:12px;${p.id === selectedId ? 'background:#2a4a3a;color:#fff' : 'color:#ccc'}"
         onmouseenter="this.style.background='${p.id === selectedId ? '#2a4a3a' : '#2a2a2a'}'" onmouseleave="this.style.background='${p.id === selectedId ? '#2a4a3a' : 'transparent'}'">
      <span style="flex:1">${label}</span>
    </div>`
  }).join('')

  el.querySelectorAll('.vm-prim-item').forEach(item => {
    item.addEventListener('click', e => {
      const id = item.dataset.primId
      if (e.ctrlKey || e.metaKey) {
        item.classList.toggle('selected-secondary')
      } else {
        el.querySelectorAll('.vm-prim-item').forEach(i => i.classList.remove('selected', 'selected-secondary'))
        selectPrimitive(id)
      }
      item.classList.add('selected')
    })
  })
}

export function cleanupVoxelModeler() {
  destroyShortcuts()
  if (renderer && renderer._resizeObserver) {
    renderer._resizeObserver.disconnect()
  }
  if (animFrameId) cancelAnimationFrame(animFrameId)
  if (scene) {
    scene.traverse(obj => {
      if (obj.isMesh) { obj.geometry.dispose(); if (obj.material) obj.material.dispose() }
    })
  }
  if (renderer) renderer.dispose()
  if (containerEl && renderer && renderer.domElement) {
    try { containerEl.removeChild(renderer.domElement) } catch {}
  }
  if (hudEl && hudEl.parentNode) hudEl.parentNode.removeChild(hudEl)
  const compassDiv = document.getElementById('vm-compass')
  if (compassDiv) compassDiv.parentNode.removeChild(compassDiv)
  primitives = []
  currentId = null
  selectedId = null
  ghostId = null
  scene = null
  camera = null
  renderer = null
  orbitControls = null
  transformControls = null
  containerEl = null
  hudEl = null
}

function escapeHtml(str) {
  if (!str) return ''
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

import * as THREE from 'three'

const _v = new THREE.Vector3()

let current = 0
let target = new THREE.Vector3(0, 0, 0)
let distance = 8
let minDist = 2, maxDist = 30
let cameras = []
let activeCamera
let dragDist = 0

let isPanning = false
let isOrbiting = false
let prevMouse = { x: 0, y: 0 }

let azimuth = 0
let elevation = Math.PI / 6

const presets = [
  { name: 'Perspectiva' },
  { name: 'Top-down' },
  { name: 'Frontal' },
  { name: 'Lateral izq.' },
  { name: 'Lateral der.' },
  { name: 'Trasera' },
]

export function initCameras(aspect) {
  cameras = presets.map(() => new THREE.PerspectiveCamera(50, aspect, 0.1, 500))
  activeCamera = cameras[0]
  applyOrbit()
  return cameras
}

export function getActiveCamera() { return activeCamera }
export function getCameras() { return cameras }
export function getCameraList() { return presets }

export function switchCamera(index) {
  if (index < 0 || index >= cameras.length) return
  current = index
  activeCamera = cameras[index]
  applyOrbit()
}

export function getCameraIndex() { return current }

export function setOrbitTarget(pos) {
  target.copy(pos)
  applyOrbit()
}

export function getOrbitAzimuth() {
  if (!activeCamera) return 0
  const dir = new THREE.Vector3()
  activeCamera.getWorldDirection(dir)
  return Math.atan2(dir.x, dir.z)
}

export function wasDragged() { return dragDist > 3 }

export function startPan(clientX, clientY) {
  isPanning = true
  dragDist = 0
  prevMouse.x = clientX
  prevMouse.y = clientY
}

export function stopPan() {
  isPanning = false
}

export function updatePan(clientX, clientY) {
  if (!isPanning) return
  const dx = clientX - prevMouse.x
  const dy = clientY - prevMouse.y
  dragDist += Math.abs(dx) + Math.abs(dy)
  prevMouse.x = clientX
  prevMouse.y = clientY

  if (!activeCamera) return

  const right = new THREE.Vector3()
  const up = new THREE.Vector3()
  activeCamera.getWorldDirection(_v)
  right.crossVectors(_v, activeCamera.up).normalize()
  up.crossVectors(right, _v).normalize()

  const factor = distance * 0.002
  target.add(right.multiplyScalar(-dx * factor))
  target.add(up.multiplyScalar(dy * factor))

  applyOrbit()
}

export function startOrbit(clientX, clientY) {
  isOrbiting = true
  dragDist = 0
  prevMouse.x = clientX
  prevMouse.y = clientY
}

export function stopOrbit() {
  isOrbiting = false
}

export function updateOrbit(clientX, clientY) {
  if (!isOrbiting) return
  const dx = clientX - prevMouse.x
  const dy = clientY - prevMouse.y
  dragDist += Math.abs(dx) + Math.abs(dy)
  prevMouse.x = clientX
  prevMouse.y = clientY

  azimuth -= dx * 0.01
  elevation = Math.max(0.05, Math.min(Math.PI / 2.5, elevation + dy * 0.01))
  applyOrbit()
}

export function zoom(delta) {
  distance = Math.max(minDist, Math.min(maxDist, distance * (1 + delta * 0.01)))
  applyOrbit()
}

export function resizeCameras(aspect) {
  cameras.forEach(c => { c.aspect = aspect; c.updateProjectionMatrix() })
}

function applyOrbit() {
  if (!activeCamera) return

  switch (presets[current].name) {
    case 'Top-down':
      activeCamera.position.set(target.x, 10, target.z + 0.01)
      activeCamera.lookAt(target.x, 0, target.z)
      return
    case 'Frontal':
      activeCamera.position.set(target.x, target.y + 1, target.z + distance)
      activeCamera.lookAt(target)
      return
    case 'Lateral izq.':
      activeCamera.position.set(target.x - distance, target.y + 1, target.z)
      activeCamera.lookAt(target)
      return
    case 'Lateral der.':
      activeCamera.position.set(target.x + distance, target.y + 1, target.z)
      activeCamera.lookAt(target)
      return
    case 'Trasera':
      activeCamera.position.set(target.x, target.y + 1, target.z - distance)
      activeCamera.lookAt(target)
      return
    default:
      const x = target.x + distance * Math.cos(elevation) * Math.sin(azimuth)
      const y = target.y + distance * Math.sin(elevation)
      const z = target.z + distance * Math.cos(elevation) * Math.cos(azimuth)
      activeCamera.position.set(x, Math.max(y, 0.5), z)
      activeCamera.lookAt(target)
  }
}

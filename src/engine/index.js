import * as THREE from 'three'
import { initScene, resize, getScene, getRenderer } from './scene.js'
import { initCameras, getActiveCamera, switchCamera, getCameras, getCameraList,
         setOrbitTarget, zoom as cameraZoom, startPan, stopPan, updatePan,
         startOrbit, stopOrbit, updateOrbit,
         wasDragged, getOrbitAzimuth, resizeCameras } from './camera.js'
import { createGrid } from './grid.js'
import { createDemoObjects } from './demo-objects.js'
import { initRaycaster, onSelectionChange, handlePick } from './raycaster.js'

let scene, renderer
let demoObjects = []
let animating = true
let lightAngle = 0
let dirLight

export function start(hostContainer) {
  const init = initScene(hostContainer)
  scene = init.scene
  renderer = init.renderer

  const ambient = new THREE.AmbientLight(0x404060, 0.5)
  scene.add(ambient)

  dirLight = new THREE.DirectionalLight(0xffeedd, 2)
  dirLight.castShadow = true
  dirLight.shadow.mapSize.width = 1024
  dirLight.shadow.mapSize.height = 1024
  scene.add(dirLight)

  const fillLight = new THREE.DirectionalLight(0x4488ff, 0.5)
  fillLight.position.set(-5, 5, -5)
  scene.add(fillLight)

  const aspect = hostContainer.clientWidth / hostContainer.clientHeight
  initCameras(aspect)
  resizeCameras(aspect)

  createGrid(scene)
  demoObjects = createDemoObjects(scene)

  const getCanvas = () => renderer.domElement
  initRaycaster(getActiveCamera, demoObjects, getCanvas)

  onSelectionChange((obj) => {
    if (obj) setOrbitTarget(obj.position)
  })

  window.addEventListener('resize', () => {
    resize()
    resizeCameras(hostContainer.clientWidth / hostContainer.clientHeight)
  })

  let ctrlHeld = false
  const canvas = renderer.domElement

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Control') ctrlHeld = true
  })

  window.addEventListener('keyup', (e) => {
    if (e.key === 'Control') ctrlHeld = false
  })

  canvas.addEventListener('mousedown', (e) => {
    if (ctrlHeld) {
      startOrbit(e.clientX, e.clientY)
    } else {
      startPan(e.clientX, e.clientY)
    }
  })

  canvas.addEventListener('mousemove', (e) => {
    if (ctrlHeld) {
      updateOrbit(e.clientX, e.clientY)
    } else {
      updatePan(e.clientX, e.clientY)
    }
  })

  canvas.addEventListener('mouseup', (e) => {
    const dragged = wasDragged()
    stopPan()
    stopOrbit()

    if (!dragged) {
      handlePick(e)
    }
  })

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault()
    cameraZoom(e.deltaY)
  }, { passive: false })

  updateLight()
  animate()
}

export function stop() {
  animating = false
}

function animate() {
  if (!animating) return
  requestAnimationFrame(animate)

  demoObjects.forEach((obj, i) => {
    obj.rotation.x += 0.003 * (i + 1)
    obj.rotation.y += 0.005 * (i + 1)
  })

  renderer.render(scene, getActiveCamera())
}

export function setLightAngle(angle) {
  lightAngle = angle
  updateLight()
}

export function getLightAngle() { return lightAngle }

function updateLight() {
  if (!dirLight) return
  const rad = lightAngle * Math.PI / 180
  const r = 12
  dirLight.position.set(r * Math.sin(rad), 15, r * Math.cos(rad))
}

export function setCamera(index) { switchCamera(index) }
export function getCamerasList() { return getCameraList() }
export function getCurrentCameraIndex() {
  const cams = getCameras()
  const active = getActiveCamera()
  return cams.indexOf(active)
}

export function getAzimuth() { return getOrbitAzimuth() }

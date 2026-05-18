import * as THREE from 'three'

let renderer, scene, clock, container

export function initScene(cont) {
  container = cont
  clock = new THREE.Clock()

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a1a2e)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1

  container.appendChild(renderer.domElement)
  resize()

  return { scene, renderer, clock }
}

export function resize() {
  if (!renderer || !container) return
  const w = container.clientWidth
  const h = container.clientHeight
  renderer.setSize(w, h)
}

export function getContainer() { return container }
export function getScene() { return scene }
export function getRenderer() { return renderer }
export function getClock() { return clock }

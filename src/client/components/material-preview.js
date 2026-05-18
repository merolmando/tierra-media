import * as THREE from 'three'

export function initPreview(container) {
  const w = container.clientWidth || 400
  const h = container.clientHeight || 300

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x2a2a3e)

  const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 100)
  camera.position.set(3, 2, 5)
  camera.lookAt(0, 0, 0)

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1
  container.appendChild(renderer.domElement)

  const ambient = new THREE.AmbientLight(0x404060, 0.5)
  scene.add(ambient)

  const keyLight = new THREE.DirectionalLight(0xffeedd, 2)
  scene.add(keyLight)

  const fillLight = new THREE.DirectionalLight(0x4488ff, 0.3)
  fillLight.position.set(-3, 1, -3)
  scene.add(fillLight)

  let angle = 0

  const geo = new THREE.SphereGeometry(1.5, 64, 64)
  const mat = new THREE.MeshStandardMaterial({
    color: 0x888888,
    roughness: 0.5,
    metalness: 0.1,
  })
  const mesh = new THREE.Mesh(geo, mat)
  scene.add(mesh)

  const ambient2 = new THREE.AmbientLight(0x404060, 0.2)
  scene.add(ambient2)

  let animating = true
  let prevTime = performance.now()

  function animate() {
    if (!animating) return
    requestAnimationFrame(animate)

    const now = performance.now()
    const dt = (now - prevTime) / 1000
    prevTime = now

    angle += dt * 0.5
    const r = 6
    keyLight.position.set(r * Math.sin(angle), 4, r * Math.cos(angle))

    mesh.rotation.y += dt * 0.3
    mesh.rotation.x += dt * 0.1

    renderer.render(scene, camera)
  }

  animate()

  const resizeObserver = new ResizeObserver(() => {
    const cw = container.clientWidth
    const ch = container.clientHeight
    if (cw > 0 && ch > 0) {
      camera.aspect = cw / ch
      camera.updateProjectionMatrix()
      renderer.setSize(cw, ch)
    }
  })
  resizeObserver.observe(container)

  return {
    updateMaterial(props) {
      const m = mesh.material
      if (props.color != null) m.color.set(props.color)
      if (props.roughness != null) m.roughness = props.roughness
      if (props.metalness != null) m.metalness = props.metalness
      m.needsUpdate = true
    },
    destroy() {
      animating = false
      resizeObserver.disconnect()
      container.removeChild(renderer.domElement)
      renderer.dispose()
    },
  }
}

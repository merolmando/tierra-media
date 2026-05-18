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

  let lightAngle = 0
  let autoRotate = true
  let camDist = 5

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
  let loadedTexId = null
  let loadedNormalId = null

  function updateCamPos() {
    camera.position.set(camDist * 0.6, camDist * 0.4, camDist)
    camera.lookAt(0, 0, 0)
  }

  function updateLightPos() {
    const rad = lightAngle * Math.PI / 180
    keyLight.position.set(6 * Math.sin(rad), 4, 6 * Math.cos(rad))
  }

  function animate() {
    if (!animating) return
    requestAnimationFrame(animate)

    const now = performance.now()
    const dt = (now - prevTime) / 1000
    prevTime = now

    if (autoRotate) {
      lightAngle = (lightAngle + dt * 30) % 360
      updateLightPos()
    }

    mesh.rotation.y += dt * 0.3
    mesh.rotation.x += dt * 0.1

    renderer.render(scene, camera)
  }

  animate()

  renderer.domElement.addEventListener('wheel', (e) => {
    e.preventDefault()
    camDist = Math.max(2, Math.min(15, camDist + e.deltaY * 0.01))
    updateCamPos()
  }, { passive: false })

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

  function setTexture(texId, influence) {
    if (!texId || texId === loadedTexId) return
    loadedTexId = texId
    fetch(`/api/resources/textures/${texId}`)
      .then(r => r.json())
      .then(data => {
        const img = new Image()
        img.onload = () => {
          const tex = new THREE.Texture(img)
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping
          mat.map = tex
          mat.needsUpdate = true
        }
        img.src = data.image
      })
      .catch(() => {})
  }

  function setNormalMap(normalId, influence) {
    if (!normalId || normalId === loadedNormalId) return
    loadedNormalId = normalId
    fetch(`/api/resources/textures/${normalId}`)
      .then(r => r.json())
      .then(data => {
        if (!data.normalMap) return
        const img = new Image()
        img.onload = () => {
          const tex = new THREE.Texture(img)
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping
          mat.normalMap = tex
          if (influence != null) mat.normalScale = new THREE.Vector2(influence, influence)
          mat.needsUpdate = true
        }
        img.src = data.normalMap
      })
      .catch(() => {})
  }

  function applyTextureScale(sx, sy) {
    if (mat.map) {
      mat.map.repeat.set(sx || 1, sy || 1)
      mat.map.needsUpdate = true
    }
    if (mat.normalMap) {
      mat.normalMap.repeat.set(sx || 1, sy || 1)
      mat.normalMap.needsUpdate = true
    }
  }

  return {
    setLightAngle(deg) {
      lightAngle = deg
      updateLightPos()
    },
    setAutoRotate(on) {
      autoRotate = on
    },
    updateMaterial(props) {
      if (props.color != null) mat.color.set(props.color)
      if (props.roughness != null) mat.roughness = props.roughness
      if (props.metalness != null) mat.metalness = props.metalness

      if (props.emissiveColor != null && props.emissiveColor !== '#000000') {
        mat.emissive.set(props.emissiveColor)
      } else if (props.emissiveColor === '#000000') {
        mat.emissive.set(0x000000)
      }
      if (props.emissiveIntensity != null) mat.emissiveIntensity = props.emissiveIntensity

      if (props.opacity != null) {
        mat.opacity = props.opacity
        mat.transparent = props.opacity < 1
      }

      if (props.textureId != null) {
        mat.map = null
        loadedTexId = null
        if (props.textureId) setTexture(props.textureId, props.textureInfluence)
      }
      if (props.normalMapId != null) {
        mat.normalMap = null
        loadedNormalId = null
        if (props.normalMapId) setNormalMap(props.normalMapId, props.normalMapInfluence)
      }

      if (props.textureScaleX != null || props.textureScaleY != null) {
        applyTextureScale(props.textureScaleX, props.textureScaleY)
      }
      if (props.normalMapInfluence != null && mat.normalMap) {
        mat.normalScale = new THREE.Vector2(props.normalMapInfluence, props.normalMapInfluence)
      }

      mat.needsUpdate = true
    },
    destroy() {
      animating = false
      resizeObserver.disconnect()
      container.removeChild(renderer.domElement)
      renderer.dispose()
    },
  }
}

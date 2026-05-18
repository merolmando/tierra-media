import * as THREE from 'three'

export function createGrid(scene) {
  const grid = new THREE.GridHelper(20, 20, 0x444466, 0x333355)
  grid.position.y = 0
  scene.add(grid)

  const axisLength = 3
  const origin = new THREE.Vector3(0, 0, 0)

  const dirs = [
    { dir: new THREE.Vector3(1, 0, 0), color: 0xff4444, label: 'X' },
    { dir: new THREE.Vector3(0, 1, 0), color: 0x44ff44, label: 'Y' },
    { dir: new THREE.Vector3(0, 0, 1), color: 0x4444ff, label: 'Z' },
  ]

  dirs.forEach(({ dir, color }) => {
    const arrow = new THREE.ArrowHelper(dir, origin, axisLength, color, 0.4, 0.2)
    scene.add(arrow)

    const coneGeo = new THREE.ConeGeometry(0.15, 0.3, 8)
    const coneMat = new THREE.MeshBasicMaterial({ color })
    const cone = new THREE.Mesh(coneGeo, coneMat)
    const endPos = dir.clone().multiplyScalar(axisLength)
    cone.position.copy(endPos)
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
    scene.add(cone)
  })

  addLabel(scene, 'X', new THREE.Vector3(axisLength + 0.3, 0, 0), 0xff4444)
  addLabel(scene, 'Y', new THREE.Vector3(0, axisLength + 0.3, 0), 0x44ff44)
  addLabel(scene, 'Z', new THREE.Vector3(0, 0, axisLength + 0.3), 0x4444ff)
}

function addLabel(scene, text, position, color) {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = 'transparent'
  ctx.fillRect(0, 0, 64, 64)
  ctx.font = 'bold 40px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#' + color.toString(16).padStart(6, '0')
  ctx.fillText(text, 32, 32)

  const texture = new THREE.CanvasTexture(canvas)
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true })
  const sprite = new THREE.Sprite(mat)
  sprite.position.copy(position)
  sprite.scale.set(0.6, 0.6, 1)
  scene.add(sprite)
}

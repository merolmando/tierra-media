import * as THREE from 'three'

export function createDemoObjects(scene) {
  const objects = []

  const geo = new THREE.BoxGeometry(1, 1, 1)

  const positions = [
    { x: 0, y: 0.5, z: 0, color: 0x44aa88 },
    { x: 2, y: 0.5, z: 1.5, color: 0xaa4488 },
    { x: -2, y: 0.5, z: -1, color: 0x88aa44 },
    { x: 1.5, y: 0.5, z: -2, color: 0x4488aa },
    { x: -1.5, y: 0.5, z: 2, color: 0xaa8844 },
  ]

  const sizes = [
    [1, 1, 1],
    [1, 0.5, 0.5],
    [0.5, 1, 0.5],
    [0.5, 0.5, 1],
    [1.5, 0.5, 0.5],
  ]

  positions.forEach((p, i) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(...sizes[i]),
      new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.3, metalness: 0.1 })
    )
    mesh.position.set(p.x, p.y, p.z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.userData.isSelectable = true
    scene.add(mesh)
    objects.push(mesh)
  })

  return objects
}

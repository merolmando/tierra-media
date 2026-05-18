import * as THREE from 'three'

const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
let selected = null
let selectables = []
let onChange = null
let prevSelected = null
let cameraGetter = null
let canvasGetter = null

export function initRaycaster(camera, objects, getCanvas) {
  selectables = objects
  cameraGetter = typeof camera === 'function' ? camera : () => camera
  canvasGetter = getCanvas
}

export function handlePick(event) {
  const cam = cameraGetter()
  const canvas = canvasGetter ? canvasGetter() : null
  if (!cam) return

  let x, y
  if (canvas) {
    const rect = canvas.getBoundingClientRect()
    x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  } else {
    x = (event.clientX / window.innerWidth) * 2 - 1
    y = -(event.clientY / window.innerHeight) * 2 + 1
  }

  pointer.x = x
  pointer.y = y

  raycaster.setFromCamera(pointer, cam)
  const intersects = raycaster.intersectObjects(selectables)

  if (intersects.length > 0) {
    selectObject(intersects[0].object)
  } else {
    selectObject(null)
  }
}

export function setSelectables(objects) {
  selectables = objects
}

export function selectObject(obj) {
  if (prevSelected && prevSelected.material && !Array.isArray(prevSelected.material)) {
    prevSelected.material.emissive.setHex(0x000000)
  }

  selected = obj

  if (obj && obj.material && !Array.isArray(obj.material)) {
    obj.material.emissive.setHex(0x444466)
  }

  prevSelected = obj

  if (onChange) onChange(obj)
}

export function onSelectionChange(cb) {
  onChange = cb
}

export function getSelected() { return selected }

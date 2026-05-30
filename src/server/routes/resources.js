import { Router } from 'express'
import { readFileSync, readdirSync, writeFileSync, unlinkSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'

const router = Router()
const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '../../../data')
const VALID_TYPES = ['materials', 'textures', 'models', 'maps', 'huds', 'inputMaps', 'structures', 'biomes']

function typePath(type) {
  return join(DATA_DIR, type)
}

function filePath(type, id) {
  return join(typePath(type), `${id}.json`)
}

router.get('/', (req, res) => {
  res.json({ types: VALID_TYPES })
})

router.get('/:type', (req, res) => {
  const { type } = req.params
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `Tipo inválido. Válidos: ${VALID_TYPES.join(', ')}` })
  }
  try {
    const files = readdirSync(typePath(type))
    const resources = files
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const data = JSON.parse(readFileSync(join(typePath(type), f), 'utf-8'))
        return { id: data.id, name: data.name, type }
      })
    res.json(resources)
  } catch {
    res.json([])
  }
})

router.get('/:type/:id', (req, res) => {
  const { type, id } = req.params
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `Tipo inválido. Válidos: ${VALID_TYPES.join(', ')}` })
  }
  const path = filePath(type, id)
  if (!existsSync(path)) {
    return res.status(404).json({ error: 'Recurso no encontrado' })
  }
  try {
    const data = JSON.parse(readFileSync(path, 'utf-8'))
    res.json(data)
  } catch {
    res.status(500).json({ error: 'Error al leer recurso' })
  }
})

router.post('/:type', (req, res) => {
  const { type } = req.params
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `Tipo inválido. Válidos: ${VALID_TYPES.join(', ')}` })
  }
  const resource = {
    id: randomUUID(),
    ...req.body,
  }
  if (!resource.name) {
    return res.status(400).json({ error: 'El campo "name" es obligatorio' })
  }
  try {
    writeFileSync(filePath(type, resource.id), JSON.stringify(resource, null, 2), 'utf-8')
    res.status(201).json(resource)
  } catch {
    res.status(500).json({ error: 'Error al guardar recurso' })
  }
})

router.put('/:type/:id', (req, res) => {
  const { type, id } = req.params
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `Tipo inválido. Válidos: ${VALID_TYPES.join(', ')}` })
  }
  const path = filePath(type, id)
  if (!existsSync(path)) {
    return res.status(404).json({ error: 'Recurso no encontrado' })
  }
  try {
    const existing = JSON.parse(readFileSync(path, 'utf-8'))
    const updated = { ...existing, ...req.body, id }
    writeFileSync(path, JSON.stringify(updated, null, 2), 'utf-8')
    res.json(updated)
  } catch {
    res.status(500).json({ error: 'Error al actualizar recurso' })
  }
})

router.delete('/:type/:id', (req, res) => {
  const { type, id } = req.params
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `Tipo inválido. Válidos: ${VALID_TYPES.join(', ')}` })
  }
  const path = filePath(type, id)
  if (!existsSync(path)) {
    return res.status(404).json({ error: 'Recurso no encontrado' })
  }
  try {
    unlinkSync(path)
    res.status(204).end()
  } catch {
    res.status(500).json({ error: 'Error al eliminar recurso' })
  }
})

export default router

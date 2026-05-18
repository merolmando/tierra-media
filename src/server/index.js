import express from 'express'
import { readFileSync, readdirSync, statSync, mkdirSync } from 'fs'
import { join, extname, dirname, relative } from 'path'
import { fileURLToPath } from 'url'
import healthRouter from './routes/health.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3000
const DOCS_DIR = join(__dirname, '../../docs')
const DEVLOG_PATH = join(__dirname, '../client/data/devlog.json')
const DIST_DIR = join(__dirname, '../../dist')
const DATA_DIR = join(__dirname, '../../data')
const DATA_TYPES = ['materials', 'textures', 'models', 'maps']
DATA_TYPES.forEach(t => mkdirSync(join(DATA_DIR, t), { recursive: true }))

app.use(express.json())
app.use('/api/health', healthRouter)

app.get('/api/devlog', (req, res) => {
  try {
    const data = JSON.parse(readFileSync(DEVLOG_PATH, 'utf-8'))
    res.json(data)
  } catch {
    res.json([])
  }
})

app.get('/api/docs/tree', (req, res) => {
  try {
    const tree = scanDocsTree(DOCS_DIR)
    res.json(tree)
  } catch {
    res.json([])
  }
})

function scanDocsTree(dir) {
  const entries = readdirSync(dir, { withFileTypes: true })
  const items = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const fullPath = join(dir, entry.name)
    let hasReadme = false
    try { hasReadme = statSync(join(fullPath, 'README.md')).isFile() } catch {}
    const children = scanDocsTree(fullPath)
    if (hasReadme || children.length > 0) {
      items.push({
        name: entry.name,
        path: relative(DOCS_DIR, fullPath),
        children,
      })
    }
  }
  return items
}

app.get(/^\/api\/docs\/(.+)$/, (req, res) => {
  const subpath = req.params[0]
  const filePath = join(DOCS_DIR, subpath)

  if (!filePath.startsWith(DOCS_DIR)) {
    return res.status(403).json({ error: 'Acceso denegado' })
  }

  try {
    const target = statSync(filePath)
    if (target.isFile() && extname(filePath) === '.md') {
      const content = readFileSync(filePath, 'utf-8')
      return res.type('text/markdown').send(content)
    }
    if (target.isDirectory()) {
      const readme = join(filePath, 'README.md')
      if (statSync(readme).isFile()) {
        const content = readFileSync(readme, 'utf-8')
        return res.type('text/markdown').send(content)
      }
    }
    res.status(404).json({ error: 'Not found' })
  } catch {
    res.status(404).json({ error: 'Not found' })
  }
})

app.use(express.static(DIST_DIR))

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' })
  res.sendFile(join(DIST_DIR, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Tierra Media server running on http://localhost:${PORT}`)
})

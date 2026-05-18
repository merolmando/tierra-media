import express from 'express'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname, dirname } from 'path'
import { fileURLToPath } from 'url'
import healthRouter from './routes/health.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3000
const DOCS_DIR = join(__dirname, '../../docs')
const DEVLOG_PATH = join(__dirname, '../client/data/devlog.json')
const DIST_DIR = join(__dirname, '../../dist')

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

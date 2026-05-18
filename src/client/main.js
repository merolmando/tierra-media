import { Router } from './router.js'
import { renderNavbar } from './components/navbar.js'
import { renderHome } from './pages/home.js'
import { renderDevlog } from './pages/devlog.js'
import { renderGame, cleanupGame } from './pages/game.js'
import { renderDev } from './pages/dev.js'
import { renderDocs } from './pages/docs.js'
import { renderMaterialCreator, cleanupMaterialCreator } from './pages/material-creator.js'
import { renderTexturePainter, cleanupTexturePainter } from './pages/texture-painter.js'
import { renderVoxelModeler, cleanupVoxelModeler } from './pages/voxel-modeler.js'
import { renderHudEditor, cleanupHudEditor } from './pages/hud-editor.js'
import { renderInputMapper, cleanupInputMapper } from './pages/input-mapper.js'
import { renderWorldGenerator, cleanupWorldGenerator } from './pages/world-generator.js'

renderNavbar()

const router = new Router({
  '/': renderHome,
  '/devlog': renderDevlog,
  '/game': renderGame,
  '/dev': renderDev,
  '/dev/material-creator': renderMaterialCreator,
  '/dev/texture-painter': renderTexturePainter,
  '/dev/voxel-modeler': renderVoxelModeler,
  '/dev/hud-editor': renderHudEditor,
  '/dev/input-mapper': renderInputMapper,
  '/dev/world-generator': renderWorldGenerator,
}, renderDocs)

router.onBeforeChange(() => {
  const hash = location.hash.slice(1)
  if (hash !== 'game' && hash !== '/game') {
    cleanupGame()
  }
  if (hash !== 'dev/material-creator' && hash !== '/dev/material-creator') {
    cleanupMaterialCreator()
  }
  if (hash !== 'dev/texture-painter' && hash !== '/dev/texture-painter') {
    cleanupTexturePainter()
  }
  if (hash !== 'dev/voxel-modeler' && hash !== '/dev/voxel-modeler') {
    cleanupVoxelModeler()
  }
  if (hash !== 'dev/hud-editor' && hash !== '/dev/hud-editor') {
    cleanupHudEditor()
  }
  if (hash !== 'dev/input-mapper' && hash !== '/dev/input-mapper') {
    cleanupInputMapper()
  }
  if (hash !== 'dev/world-generator' && hash !== '/dev/world-generator') {
    cleanupWorldGenerator()
  }
})

router.init()

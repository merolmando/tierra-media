import { Router } from './router.js'
import { renderNavbar } from './components/navbar.js'
import { renderHome } from './pages/home.js'
import { renderDevlog } from './pages/devlog.js'
import { renderGame, cleanupGame } from './pages/game.js'
import { renderDev } from './pages/dev.js'
import { renderDocs } from './pages/docs.js'
import { renderMaterialCreator, cleanupMaterialCreator } from './pages/material-creator.js'
import { renderTexturePainter, cleanupTexturePainter } from './pages/texture-painter.js'

renderNavbar()

const router = new Router({
  '/': renderHome,
  '/devlog': renderDevlog,
  '/game': renderGame,
  '/dev': renderDev,
  '/dev/material-creator': renderMaterialCreator,
  '/dev/texture-painter': renderTexturePainter,
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
})

router.init()

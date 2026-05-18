# Motor gráfico

## Visión general

El motor gráfico es el núcleo visual del proyecto. Gestiona renderizado, luces, cámaras, selección de objetos y el grid de referencia 3D.

## Dependencias entre módulos

```
scene.js ──→ rendering (renderer, luces, resize)
    │
    ├──→ camera.js (6 presets, pan, órbita, zoom)
    ├──→ raycaster.js (selección con coordenadas canvas-relativas)
    └──→ grid.js (GridHelper 20×20 + ejes XYZ con labels)
```

## Ciclo de renderizado

```
init() → setupScene(), setupLights(), setupGrid()
              ↓
requestAnimationFrame(loop)
              ↓
    updateCamera() → render()
```

## Eventos de mouse

Todos los eventos están atados al canvas (`renderer.domElement`), no a `window`:

| Evento | Acción | Condición |
|---|---|---|
| `mousedown` → `mousemove` | Pan o órbita | `movementX/Y > umbral` |
| `mousedown` → `mouseup` sin drag | Selección | `movementX/Y < umbral` |
| Ctrl + `mousedown` + `mousemove` | Órbita | `ctrlKey` |
| `mousedown` + `mousemove` (sin Ctrl) | Pan | — |
| `wheel` | Zoom | — |

Coordenadas resueltas con `canvas.getBoundingClientRect()` para raycaster y resize.

## Módulos

| Módulo | Archivo | Descripción |
|---|---|---|
| **Renderizado** | `docs/engine/rendering/README.md` | Escena, luces, renderer, sombras, tone mapping |
| **Cámara** | `docs/engine/camera/README.md` | 6 presets, pan, órbita, zoom, azimuth |
| **Raycaster** | `docs/engine/raycaster/README.md` | Selección vía raycasting, resaltado, re-centrado |
| **Grid** | `docs/engine/grid/README.md` | GridHelper 20×20, ejes XYZ con ArrowHelper y labels sprite |

## Archivos fuente

- `src/engine/index.js` — entry point del motor, init, loop, resize
- `src/engine/scene.js` — renderer, escena, resize, luces
- `src/engine/camera.js` — sistema de cámaras y controles
- `src/engine/raycaster.js` — selección de objetos
- `src/engine/grid.js` — grid y ejes

## API pública del motor

| Exportación | Descripción |
|---|---|
| `init(container)` | Inicializa motor en un contenedor DOM |
| `loop()` | Tick de renderizado (requestAnimationFrame) |
| `resize()` | Recalcula tamaño según container |
| `setCameraPreset(name)` | Cambia preset de cámara |
| `setLightAngle(deg)` | Ajusta ángulo de luz direccional |
| `getAzimuth()` | Devuelve azimuth actual de cámara (grados) |
| `getSelected()` | Devuelve objeto seleccionado o null |
| `getScene()` | Devuelve la escena Three.js |

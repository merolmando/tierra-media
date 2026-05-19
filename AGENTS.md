# Tierra Media — Plan de desarrollo

## Pipeline completo de herramientas (orden de implementación)

```
  1. Material Creator ──→  2. Texture Painter ──→  3. Voxel Modeler ──┐
                                                  4. HUD Editor ──────┤
                                                  5. Input Mapper ────┤
                                                                      ↓
                                            6. World Generator ──→ 7. Studio ──→ 8. Game
```

| # | Herramienta | Produce | Consume |
|---|---|---|---|
| 1 | **Material Creator** | `materials/*.json` | — |
| 2 | **Texture Painter** | `textures/*.json` + PNG | Materials (como pinceles) |
| 3 | **Voxel Modeler** | `models/*.json` | Materials |
| 4 | **HUD Editor** | `huds/*.json` | Textures, Input Maps |
| 5 | **Input Mapper** | `inputMaps/*.json` | — |
| 6 | **World Generator** | `worlds/*.json` | — |
| 7 | **Studio** (futuro) | `maps/*.json` | Models, Materials, HUDs |
| 8 | **Game** (runtime) | — | Maps, HUDs, Input Maps |

## Fase actual — World Generator (herramienta #6) ✓ COMPLETADA

### Estado de herramientas

| Herramienta | Estado | Archivo principal |
|---|---|---|
| Material Creator | ✅ Completo | `src/client/pages/material-creator.js` |
| Texture Painter | ✅ Completo | `src/client/pages/texture-painter.js` |
| Voxel Modeler | ✅ Completo | `src/client/pages/voxel-modeler.js` |
| HUD Editor | ✅ Completo | `src/client/pages/hud-editor.js` |
| Input Mapper | ✅ Completo | `src/client/pages/input-mapper.js` |
| World Generator | ✅ Completo | `src/client/pages/world-generator.js` |
| Studio | ⬜ Pendiente | — |
| Game | ⬜ Pendiente | `src/engine/game.js` |

---

## World Generator — Documentación completa

### Jerarquía de capas

El generador organiza el terreno en 3 niveles jerárquicos de detalle:

```
Macro (8×8 tiles)  →  Zona (4×4 celdas por macro)  →  Mapa (2×2 tiles por zona)
   continentes              regiones / detalle             local / voxels
      ~1px                    8×8px (vista completa)       16×16 bloques 3D
```

Cada capa hereda información de la capa superior:
- **Macro** genera alturas base independientes con Perlin noise + warping + tectónica + clima
- **Zona** interpola alturas/temperatura/presión del macro mediante `sampleGrid()` (bilineal desde vecindario 3×3) y agrega ruido detalle + erosión
- **Mapa** genera altura independiente con fBm y produce bloques voxel para 3D

### Arquitectura del código (`world-generator.js`)

#### Estado global (variables de módulo)

| Variable | Tipo | Propósito |
|---|---|---|
| `currentId` | `string\|null` | UUID del mundo cargado |
| `worldData` | `Object\|null` | Datos completos del mundo (tiles, reglas, altura, seed, etc.) |
| `layerStack` | `string[]` | Pila de capas activas: `['macro']`, `['macro','zona']`, `['macro','zona','mapa']` |
| `selMacro/Zona/Mapa` | `[n,n]\|null` | Coordenadas de tile seleccionado en cada capa |
| `previewCanvas/Ctx` | `HTMLCanvasElement\|null` | Canvas principal de previsualización 2D |
| `show3d` | `boolean` | Vista 3D activa |
| `touring` | `boolean` | Tour automático activo |
| `fullMapView` | `boolean` | Vista de mapa completo activa |
| `fullCanvas` | `HTMLCanvasElement\|null` | Off-screen canvas del mapa completo |
| `fullZoom` | `number` | Nivel de zoom en vista completa (1–20×) |
| `fullPanX/Y` | `number` | Desplazamiento panorámico en vista completa |
| `fullDragging` | `boolean` | Arrastre para panorámica activo |

#### Constantes

| Constante | Valor | Descripción |
|---|---|---|
| `DEFAULT_REGLAS.macro` | `{ distorsionFrecuencia, distorsionMagnitud, cotaMar, transicionCosta, detalleRuido, detalleOctaves, placas, tectFuerza, tectElevacion, tectSubsidencia, vientoEscala, alturaInflTemp }` | Reglas por defecto para generación macro |
| `DEFAULT_REGLAS.zona` | `{ detalleEscala, detalleOctaves, detalleAmp, varTemp, eoEolica, eoHidrica }` | Reglas por defecto para generación zona |
| `DEFAULT_REGLAS.mapa` | `{ noise, scale, octaves, amplitude, persistence, mar }` | Reglas por defecto para generación mapa |
| `DEFAULT_TILES` | `{ macro: 8, zona: 4, mapa: 2 }` | Tamaños de grilla por defecto |
| `DEFAULT_ALTURA` | `{ abajo: 3, arriba: 3 }` | Chunks de altura por defecto |

#### Clase Perlin (línea 41)

Implementación clásica de Perlin noise con tabla de permutación seedeable y fBm.

| Método | Parámetros | Retorno | Descripción |
|---|---|---|---|
| `constructor(seed)` | `seed` — entero para reproducibilidad | — | Crea tabla de permutación de 256 valores usando LCG |
| `fade(t)` | `t` | `float` | Curva Hermite 6to orden para suavizado |
| `lerp(a, b, t)` | `a, b` — extremos, `t` — fracción | `float` | Interpolación lineal |
| `grad(hash, x, y)` | `hash` (0–255), `x, y` | `float` | Producto punto con gradiente pseudoaleatorio |
| `noise2D(x, y)` | `x, y` | `[-1, 1]` | Perlin noise bidimensional |
| `fbm(x, y, octaves, scale, amplitude, persistence)` | Parámetros estándar de ruido fraccional | `float` | Suma de octavas de noise con frecuencia creciente y amplitud decreciente |

#### Funciones de generación

##### `generateMacro(world, reglas)` (línea 89)
Genera la grilla de terreno a nivel macro (continentes) con sistema completo de clima.

**Pipeline interno:**
1. **Altura base**: Ruido Perlin con domain warping (`x + warpX * distorsionMagnitud`) para formas orgánicas
2. **Máscara continental**: Sigmoid `1/(1+exp(-(noise - cotaMar)/transicionCosta))` para separar tierra/océano
3. **Detalle**: Ruido de alta frecuencia solo en tierra firme (`detail * max(0, mask - 0.45) * 4`)
4. **Tectónica**: N puntos aleatorios conectados por vecino más cercano → fallas con elevación/subsidencia
5. **Temperatura**: `latFactor - hNorm * alturaInflTemp - depthFactor` (norte=0, centro=1, sur=0)
6. **Presión**: Inversa de temperatura (`1 - temp`)
7. **Viento**: Gradiente de presión + Coriolis + aceleración en crestas (`slopeFactor = 1 + |pendiente| * 2`)

**Retorno**: `{ heights, temps, minH, maxH, pressure, windU, windV, windStrength, faultSegments }`

##### `sampleGrid(grid, cols, rows, wx, wy)` (línea 278)
Interpolación bilineal de una grilla 2D en coordenadas flotantes, con clamping en bordes.

**Uso**: `generateZona` la usa para samplear alturas/temperatura/presión del macro en posiciones fraccionales, dando transiciones suaves entre tiles macro vecinos.

##### `generateZona(world, macroX, macroY, reglas, macroData)` (línea 296)
Genera terreno regional con detalle heredado del macro.

**Pipeline interno:**
1. **Base desde macro por sampleo 3×3**: Cada celda `(zx, zy)` calcula su posición `wx = macroX + (zx+0.5)/cols` y samplea altura/temp/presión con `sampleGrid()`
2. **`factorTierra`** (línea 316-317): Amortiguación cuadrática del ruido detalle en océano:
   - `factorLineal = max(0, min(1, 1 + baseH / (detAmp * 0.5)))`
   - `factorTierra = factorLineal²`
   - A profundidad > `detAmp * 0.5` el detalle es 0 (océano plano)
   - En costa, transición suave que permite islas pequeñas
3. **Temperatura**: `baseT + variación * varTemp`
4. **Humedad**: `(1 - basePressure) * 0.5 + ruido * 0.3`
5. **Viento local**: Gradiente de temperatura micro (para erosión)
6. **Erosión** (2 iteraciones):
   - **Eólica**: Desgasta donde viento local > 0.3
   - **Hídrica**: Lluvia = `temp * (1-temp) * 4`, transporta sedimento cuesta abajo

**Retorno**: `{ heights, temps, hums }` (cada uno 2D array `[rows][cols]`)

##### `generateMapa(world, macroX, macroY, zonaX, zonaY, reglas)` (línea 374)
Genera terreno local con fBm independiente, seedeado por posición para determinismo.

**Retorno**: `heights[y][x]` — enteros

##### `generateBlocks(world, macroX, macroY, zonaX, zonaY, mapaX, mapaY, reglas)` (línea 390)
Genera bloques voxel para visualización 3D. Usa `generateMapa` internamente.

**Retorno**: Array de `{ x, y, z }`

#### Funciones de renderizado

##### `render2D()` (línea 495)
Función principal de renderizado. Dibuja la capa activa en el canvas de previsualización.

**Flujo:**
1. Guard: retorna si `fullMapView` activo
2. Determina capa activa desde `layerStack`
3. **Macro**: altura en grises + overlays (calor/presión/viento/tectónica) con alpha 0.2 + fallas
4. **Zona**: altura en grises normalizada al rango `minH/maxH` del macro entero
5. **Mapa**: altura + overlay de calor (opcional)

##### `drawMiniMap(ctx, w, h)` (línea 621)
Minimapa de biomas del mundo completo (macro × todas las zonas).

##### `renderFullMap()` (línea 1030)
Renderiza el mapa completo (macro × zona) en un off-screen canvas de 8px por celda, con `drawFullMap()` para mostrarlo con zoom/pan.

##### `drawFullMap()` (línea 1062)
Dibuja el off-screen canvas en el viewport con transformaciones `translate(fullPanX, fullPanY)` y `scale(fullZoom, fullZoom)`.

#### Funciones de interacción

##### `onCanvasClick(e)` (línea 723)
Maneja clicks en el canvas para navegación entre capas (macro → zona → mapa).

##### `renderLayerNav()` (línea 760)
Renderiza botones de navegación jerárquica entre capas.

##### `renderReglas()` (línea 795)
Panel de edición de reglas (sidebar derecha) con inputs en tiempo real.

**Campos por capa:**
- **Macro**: Distorsión (frecuencia, magnitud), Continentes (cota mar, transición costa), Detalle (ruido, octaves), Tectónica (puntos, fuerza, elevación, subsidencia), Viento (escala), Temperatura (enfriamiento por altura)
- **Zona**: Detalle (escala, octaves, amplitud), Variación temp, Erosión (eólica, hídrica)
- **Mapa**: Tipo ruido, Scale, Octaves, Amplitud, Persistencia, Nivel del mar

#### Tour y mapa completo

##### `startTour()` (línea 990)
Recorrido automático por todas las combinaciones macro × zona × mapa, con 500ms por paso.

##### Vista completa (`fullMapView`)
- Botón "🗺 Vista completa" / "◀ Volver"
- Renderiza todas las zonas en un off-screen canvas (8px/celda)
- Zoom con rueda del mouse (1–20×)
- Pan con drag (solo con zoom > 1)

#### Funciones de gestión de mundos

| Función | Línea | Descripción |
|---|---|---|
| `newWorld()` | 912 | Crea mundo nuevo con defaults |
| `loadWorld(id)` | 955 | Carga mundo desde API |
| `saveWorld()` | 977 | Guarda mundo (POST/PUT según exista) |
| `deleteWorld(id)` | 970 | Elimina mundo |
| `renderWorldList()` | 936 | Lista mundos guardados |

### Funciones de color

| Función | Línea | Descripción |
|---|---|---|
| `tempColor(t, alpha)` | 409 | Escala rojo-azul para temperatura |
| `depthColor(h, minH, maxH)` | 417 | Rampa 10 paradas para relieve (no usado actualmente) |
| `heightGray(h, minH, maxH)` | 447 | Escala de grises 6 paradas |
| `biomeColor(temp, hum)` | 469 | Color de bioma (desierto/tundra/bosque/etc) |
| `pressureColor(v, alpha)` | 477 | Presión: azul (baja) → rojo (alta) |
| `windColor(v, alpha)` | 486 | Viento: verde (bajo) → rojo (alto) |

## API de recursos

```
GET    /api/resources/:type        — listar
POST   /api/resources/:type        — crear
PUT    /api/resources/:type/:id    — actualizar
DELETE /api/resources/:type/:id    — eliminar
```

Tipos válidos: `materials`, `textures`, `models`, `maps`, `huds`, `inputMaps`, `worlds`, `structures`

## Próximos pasos

- Studio (#7): editor de mapas 3D para colocar modelos del Voxel Modeler sobre terreno generado
- Game: integrar bindings personalizados del Input Mapper + HUDs personalizados
- Pipeline build: exportar modelos a .glb/.obj
- World Generator: overlays en capa zona, capa mapa con herencia de zona

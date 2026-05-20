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

## Fase actual — World Generator (herramienta #6) — EN REDISEÑO

### Estado de herramientas

| Herramienta | Estado | Archivo principal |
|---|---|---|
| Material Creator | ✅ Completo | `src/client/pages/material-creator.js` |
| Texture Painter | ✅ Completo | `src/client/pages/texture-painter.js` |
| Voxel Modeler | ✅ Completo | `src/client/pages/voxel-modeler.js` |
| HUD Editor | ✅ Completo | `src/client/pages/hud-editor.js` |
| Input Mapper | ✅ Completo | `src/client/pages/input-mapper.js` |
| World Generator | 🔄 En rediseño | `src/client/pages/world-generator.js` |
| Studio | ⬜ Pendiente | — |
| Game | ⬜ Pendiente | `src/engine/game.js` |

---

## Sistema de generación por capas — Especificación

El generador separa la creación del mundo en **capas de resolución anidadas** y **capas de datos**. Cada tile de capa N representa un área completa en capa N+1. El sistema está diseñado para cálculo perezoso: solo se genera lo que se necesita visualizar.

### Jerarquía de resolución

```
Capa 1 — Continental (n×n tiles)  →  Capa 2 — Regional (m×m por tile C1)  →  Capa 3 — Local (p×p por tile C2)
   cerebro físico/climático              refinar relieve / clima local          terreno 3D jugable
   matrices 2D globales                  herencia interpolada 3×3               bloques voxel
```

Reglas de herencia:
- Capa 2 interpola datos de Capa 1 (vecindario 3×3, bilineal) como base
- Capa 2 **no puede modificar** datos de Capa 1 — la continental es autoritativa
- Capa 3 genera terreno independiente pero condicionado por datos de Capa 2

---

## Capa 1 — Continental (especificación completa)

### Concepto

La Capa 1 es el cerebro físico, climático y cronológico del mundo. Opera sobre un lienzo **n×n** configurable (n default 8; cada celda = un tile continental). Corre en segundo plano sin manejar bloques individuales — solo reglas globales y matrices 2D ultraligeras.

### Input

| Parámetro | Default | Descripción |
|---|---|---|
| `seed` | aleatorio | Reproducibilidad |
| `tiles` | 8 | Tamaño del lienzo (n×n) — cada celda = 1 tile continental |
| `escala` | 0.05 | Escala del Perlin noise para continentes |
| `cotaMar` | 0.45 | Umbral de la sigmoide tierra/océano |
| `transicionCosta` | 0.1 | Suavizado de costa |
| `detalleRuido` | 30 | Escala del ruido de detalle en tierra firme |
| `detalleOctaves` | 4 | Octavas del detalle |
| `placas` | 4 | Puntos de falla tectónica |
| `tectFuerza` | 0.5 | Intensidad tectónica |
| `tectElevacion` | 0.3 | Levantamiento en fallas |
| `tectSubsidencia` | 0.2 | Hundimiento en fallas |
| `vientoEscala` | 1 | Escala global del viento |
| `alturaInflTemp` | 0.3 | Cuánto enfría la altura |
| `velocidadDia` | 25 | Minutos reales por día completo |
| `estacion` | 0 | Estación actual (0=primavera, 1=verano, 2=otoño, 3=invierno) |

### Output (3 matrices 2D estáticas + 4 dinámicas + sistema temporal)

#### Matrices base (se generan una vez, seedeables)

| Matriz | Rango | Descripción |
|---|---|---|
| **Altura Base** `H[y][x]` | 0.0–1.0 | Molde del mundo (0.0 fosa, 0.5 nivel del mar, 1.0 pico). Perlin noise + domain warp + máscara continental sigmoide + tectónica de fallas |
| **Temperatura Latitud** `TL[y][x]` | 0.0–1.0 | Solo por latitud: norte=0.0 (frío), centro=1.0 (cálido), sur=0.0 (frío) |
| **Temperatura Real** `TR[y][x]` | 0.0–1.0 | `TL[y][x] - H[y][x] * alturaInflTemp` (a más altura, más frío). Ajustado por profundidad oceánica |

#### Matrices dinámicas (se recalculan en cada tick del reloj)

| Matriz | Rango | Cálculo |
|---|---|---|
| **Presión** `P[y][x]` | 0.0–1.0 | Inversa de temperatura real: `1 - TR[y][x]`. Alta presión donde hace frío |
| **Viento U/V** `WU[y][x]`, `WV[y][x]` | -1..1 | Gradiente de presión + corrección Coriolis (latitud). Viento sopla de alta→baja presión, desviado por rotación planetaria |
| **Humedad** `Hum[y][x]` | 0.0–1.0 | Arrastrada desde océanos por vientos. `Hum = base * (1 - distanciaACosta) * vientoFactor` |
| **Lluvia / Precipitación** `R[y][x]` | 0.0–1.0 | `Hum * slopeFactor` — la humedad precipita al chocar con montañas (gradiente de altura). A más pendiente, más lluvia |
| **Erosión Hidráulica** `E[y][x]` | delta | `R * pendiente * factor` — desgasta el molde H anualmente (cada ~300 días). Efecto acumulativo mínimo pero real |

### Reloj Planetario

#### Ciclo diario (~25 min reales = 24h juego)
- 1 día = 25 minutos reales configurables (`velocidadDia`)
- Se divide en 24 horas
- Cada hora avanza el sol: `ánguloSol = (hora / 24) * 2π`
- Hora local según coordenada X: `horaLocal[x] = (horaGlobal + x * 24 / tiles) % 24`
- Esto crea **husos horarios reales** en el mapa

#### Ciclo de estaciones (4)
- Primavera → Verano → Otoño → Invierno
- Cada estación modifica la inclinación del eje planetario:
  - Invierno: sol más bajo → días cortos, más frío
  - Verano: sol más alto → días largos, más calor
- Afecta `TL[y][x]` (desplaza latFactor) y la duración del día
- Transición suave entre estaciones (interpolación)

#### Tick del motor
En runtime (Game):
- Cada X segundos reales = 1 hora de juego
- Se recalcula: presión, viento, humedad, lluvia según hora + estación
- Cada ~300 días (año): se aplica erosión hidráulica al molde H

### Output visual — Skybox

La Capa 1 alimenta el skybox del engine:
- **Posición del sol/luna** en la escena 3D según hora del día
- **Color del cielo** según hora + estación:
  - 12 texturas de skybox (3 fases × 4 estaciones): amanecer, mediodía, atardecer por estación
  - Mezcla gradual interpolada para transición fluida
  - Shader que combina color del cielo, intensidad de luz, niebla

---

## Capa 2 — Regional (borrador conceptual)

*— Pendiente de diseñar —*

Toma datos de Capa 1 por tile continental + vecindario 3×3. Refina relieve, clima local, biomas. No puede modificar la continental.

## Capa 3 — Local (especificación completa)

### Concepto

La Capa 3 genera el terreno local detallado a partir de los datos de Capa 2 (zData). Subdivide cada tile de zona en una cuadrícula `mapa×mapa` (default 8×8) y produce un campo de alturas continuo con micro-detalle Perlin, coloreado por bioma para visualización 3D. No puede modificar la regional.

### Herencia

Cada celda local (x, y) se calcula desde zData mediante `sampleGrid2D`:

| Matriz | Herencia |
|---|---|
| `heights[y][x]` | `sampleGrid2D(zData.h, nx, ny) + microPerlin × 0.08`, clamped 0..1 |
| `temps[y][x]` | `sampleGrid2D(zData.temp, nx, ny)` |
| `hums[y][x]` | `sampleGrid2D(zData.hum, nx, ny)` |
| `floras[y][x]` | `sampleGrid2D(zData.flora, nx, ny)` |
| `rios[y][x]` | `sampleGrid2D(zData.rios, nx, ny)` |

Coordenadas normalizadas: `nx = (zonaX * cols + x + 0.5) / (zCols * cols)`

### Bloques 3D

`generateBlocks()` produce bloques coloreados para visualización con `InstancedMesh`:

1. Por cada celda local (z, x), computa altura de superficie `surfY = round(h * voxH)`
2. Agua (`h < 0.5`): azul oscuro uniforme
3. Superficie (`surfY - y < 1`): verde según flora, atenuado por temperatura
4. Ríos (`rio > 0.3 && surfY - y < 1`): azul medio
5. Subsuelo (`surfY - y < 4`): marrón degradado
6. Roca profunda: gris progresivo según profundidad

Límite: 30k instancias máximo. `mapa = 8` → 8×8 = 64 celdas con ~50 bloques cada una ≈ 3200 bloques.

### Output 2D — Overlays en vista mapa

| Overlay | Origen | Descripción |
|---|---|---|
| `showDepth` | `lData.heights` | `depthColor()` con altura normalizada, océano = `h × 0.44` |
| `showHeat` | `lData.temps` | `tempColor()` alpha 0.3 |
| `showHum` | `lData.hums` | `humColor()` alpha 0.25 |
| `showRain` | `lData.rios` | `rioColor()` alpha 0.3 |
| `showBiome` | `lData.temps + hums` | `biomeColor()` alpha 0.4 |

### Parámetros

Los parámetros de la Capa 3 son los tiles `mapa` y `mapaBlk` del mundo:
- `world.tiles.mapa[0]` (default 8): resolución del lienzo local
- `world.tiles.mapaBlk` (default 8): subdivisión de bloques (no usado directamente por generateLocal, que usa mapa como resolución directa)

---

## Modo simulación en World Generator

El generador debe permitir:
- Ver las 3 matrices base (altura, temp latitud, temp real) como overlays
- Ver las 4 matrices dinámicas (presión, viento, humedad, lluvia) en tiempo real
- **Control de tiempo**: slider para avanzar/retroceder horas, botón de pausa/reproducir
- **Aceleración**: ×1, ×10, ×100, ×1000 para ver ciclos rápidamente
- **Salto de año**: botón para aplicar un año de erosión y ver el cambio en el molde H
- Las matrices dinámicas se recalculan al cambiar hora/estación
- Overlays combinables (checkboxes) como el sistema actual

---

## Plan de implementación (Capa 1)

| Etapa | Descripción | Estado |
|---|---|---|
| 1 | Motor climático: 3 matrices base + presión/viento/humedad/lluvia | ✅ Completo |
| 2 | Ciclo solar: reloj 25min→24h, hora según X, skybox output | ✅ Completo |
| 3 | Ciclo estaciones: 4 estaciones, inclinación, modificación clima | ✅ Completo |
| 4 | Erosión hidráulica: aplicación anual, efecto mínimo sobre H | ✅ Completo |
| 5 | Modo simulación en World Generator: controles de tiempo, aceleración | ✅ Completo |
| 6 | Skybox: 12 texturas, mezcla por shader, transición fluida | ⬜ Pendiente |
| 7 | Capa 2 — Regional | ✅ Completo |
| 8 | Capa 3 — Local | ✅ Completo |

---

## API de recursos

```
GET    /api/resources/:type        — listar
POST   /api/resources/:type        — crear
PUT    /api/resources/:type/:id    — actualizar
DELETE /api/resources/:type/:id    — eliminar
```

Tipos válidos: `materials`, `textures`, `models`, `maps`, `huds`, `inputMaps`, `worlds`, `structures`

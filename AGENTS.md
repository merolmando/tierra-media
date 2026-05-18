# Tierra Media — Plan de desarrollo

## Pipeline completo de herramientas (orden de implementación)

```
  1. Material Creator ──→  2. Texture Painter ──→  3. Voxel Modeler ──┐
                                                 4. HUD Editor ──────┤
                                                 5. Input Mapper ────┤
                                                                     ↓
                                                           6. Studio ──→ 7. Game
```

| # | Herramienta | Produce | Consume |
|---|---|---|---|
| 1 | **Material Creator** | `materials/*.json` | — |
| 2 | **Texture Painter** | `textures/*.json` + PNG | Materials (como pinceles) |
| 3 | **Voxel Modeler** | `models/*.json` | Materials |
| 4 | **HUD Editor** | `huds/*.json` | Textures, Input Maps |
| 5 | **Input Mapper** | `inputMaps/*.json` | — |
| 6 | **Studio** | `maps/*.json` | Models, Materials, HUDs |
| 7 | **Game** (runtime) | — | Maps, HUDs, Input Maps |

## Fase actual — Material Creator (herramienta #1)

### Archivos a crear
- `src/client/components/material-preview.js` — Preview 3D con esfera + luces + auto-rotación
- `src/client/pages/material-creator.js` — Página con sidebar (lista) + preview + panel de propiedades

### Archivos a modificar
- `src/client/main.js` — Agregar ruta `/dev/material-creator` y cleanup
- `src/client/pages/dev.js` — Convertir card de Material Creator en enlace clickeable

### Layout de la página
```
┌──────────────────────────────────────────────────────┐
│  Material Creator                     [Nuevo]         │
├────────────┬──────────────────────────┬───────────────┤
│            │                          │  Nombre:      │
│  Lista     │      Preview 3D          │  [input]      │
│  de        │      (esfera gira)       │               │
│  mate-     │                          │  Color:       │
│  riales    │                          │  [picker]     │
│            │                          │               │
│  Piedra █  │                          │  Roughness:   │
│  Madera █  │                          │  [==●=====]   │
│  Roca   █  │                          │               │
│            │                          │  Metalness:   │
│            │                          │  [●=======]   │
│            │                          │               │
│            │                          │  Normal Map:  │
│            │                          │  [dropdown ▼] │
│            │                          │               │
│            │                          │  [Guardar]    │
│            │                          │  [Eliminar]   │
└────────────┴──────────────────────────┴───────────────┘
```

### API utilizada
- `GET /api/resources/materials` — listar
- `POST /api/resources/materials` — crear
- `PUT /api/resources/materials/:id` — actualizar
- `DELETE /api/resources/materials/:id` — eliminar

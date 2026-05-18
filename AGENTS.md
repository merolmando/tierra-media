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

## Fase actual — Texture Painter (herramienta #2, próxima)

### Schema de Material (`materials/*.json`)
```json
{
  "id": "uuid",
  "name": "Piedra gris",
  "color": "#666666",
  "roughness": 0.8,
  "metalness": 0.1,
  "emissiveColor": "#000000",
  "emissiveIntensity": 0,
  "opacity": 1.0,
  "weight": 5.0,
  "strength": 100,
  "stateOfMatter": "solid",
  "textureId": null,
  "textureScaleX": 1,
  "textureScaleY": 1,
  "textureInfluence": 1.0,
  "normalMapId": null,
  "normalMapInfluence": 1.0
}
```
`stateOfMatter`: `solid` | `liquid` | `gas` | `plasma`

### API utilizada
- `GET /api/resources/materials` — listar
- `POST /api/resources/materials` — crear
- `PUT /api/resources/materials/:id` — actualizar
- `DELETE /api/resources/materials/:id` — eliminar
- `GET /api/resources/textures` — para selectores de texture/normal map

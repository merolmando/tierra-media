# Herramientas de desarrollo

## Visión general

Todas las herramientas comparten una arquitectura común:

- **Servidor único** — los recursos se almacenan en el servidor, accesibles desde cualquier herramienta
- **Formato común** — datos serializados en JSON con referencias por UUID
- **Pipeline integrado** — la salida de una herramienta es entrada de otra

## Dependencias entre herramientas

```
   Material Creator ──→   Texture Painter ──→   Voxel Modeler ──┐
                         4. HUD Editor ─────────────────────────┤
                         5. Input Mapper ───────────────────────┤
                                                                ↓
                                                      6. Studio ──→ 7. Game
```

| Herramienta | Produce | Consume de |
|---|---|---|
| **Material Creator** | Material (color, roughness, metalness, mapas) | — |
| **Texture Painter** | Textura (imagen PNG + normal map) | Material (como pinceles) |
| **Voxel Modeler** | Modelo (malla primitivas + materiales) | Material (por primitiva) |
| **HUD Editor** | HUD (layout de UI con bars/text/image/button) | Textures, Input Maps |
| **Input Mapper** | Input Map (bindings tecla→acción) | — |
| **Studio** | Mapa (modelos posicionados en el mundo) | Modelo + Material + HUD |

## API de recursos

Todas las herramientas usan una API REST genérica:

```
GET    /api/resources                 → lista tipos disponibles
GET    /api/resources/:type           → lista recursos de un tipo
GET    /api/resources/:type/:id       → obtiene un recurso
POST   /api/resources/:type           → crea un recurso
PUT    /api/resources/:type/:id       → actualiza un recurso
DELETE /api/resources/:type/:id       → elimina un recurso
```

Tipos de recursos: `materials`, `textures`, `models`, `maps`, `huds`, `inputMaps`.

## Estructura de datos

### Material
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

### Textura
```json
{
  "id": "uuid",
  "name": "Textura piedra",
  "width": 512,
  "height": 512,
  "format": "png",
  "image": "data:image/png;base64,...",
  "normalMap": "data:image/png;base64,..."
}
```

### Modelo
```json
{
  "id": "uuid",
  "name": "Roca pequeña",
  "primitives": [
    {
      "id": "uuid",
      "type": "box",
      "position": [0, 0.5, 0],
      "rotation": [0, 0, 0],
      "scale": [1, 1, 1],
      "params": { "width": 1, "height": 1, "depth": 1 },
      "materialId": "uuid-material"
    }
  ]
}
```

### HUD
```json
{
  "id": "uuid",
  "name": "Main HUD",
  "resolution": { "width": 1920, "height": 1080 },
  "elements": [
    {
      "id": "uuid",
      "type": "bar",
      "label": "HP",
      "anchor": "bottom-left",
      "position": { "x": 20, "y": 20 },
      "size": { "width": 200, "height": 24 },
      "backgroundColor": "#222222",
      "fillColor": "#cc3333",
      "borderColor": "#555555",
      "borderWidth": 1,
      "textureId": null,
      "fontFamily": "monospace",
      "fontSize": 14,
      "fontColor": "#ffffff",
      "text": "HP",
      "opacity": 1.0,
      "visible": true,
      "action": ""
    }
  ]
}
```

### Input Map
```json
{
  "id": "uuid",
  "name": "Default Controls",
  "bindings": [
    { "id": "uuid", "action": "move_forward", "code": "KeyW" },
    { "id": "uuid", "action": "attack", "code": "Mouse0" }
  ]
}
```

### Mapa
```json
{
  "id": "uuid",
  "name": "Aldea inicial",
  "models": [
    { "modelId": "uuid-modelo", "position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1] }
  ]
}
```

## Almacenamiento en servidor

```
data/
├── materials/     → .json por material
├── textures/      → .json + .png
├── models/        → .json
├── huds/          → .json
├── inputMaps/     → .json
└── maps/          → .json
```

## ResourcePicker

Todas las herramientas comparten un componente de navegación de recursos que permite:

- Explorar recursos por tipo (materiales, texturas, modelos, mapas)
- Buscar por nombre
- Vista previa del recurso
- Arrastrar recursos entre herramientas

## Pipelines de producción

### Pipeline principal
```
Material Creator → Texture Painter → Voxel Modeler → Studio → Juego
```

### Pipeline alternativo
```
Material Creator → Voxel Modeler → Studio → Juego
```
(sin texturas personalizadas, usando solo colores y propiedades PBR)

# Herramientas de desarrollo

## Visión general

Todas las herramientas comparten una arquitectura común:

- **Servidor único** — los recursos se almacenan en el servidor, accesibles desde cualquier herramienta
- **Formato común** — datos serializados en JSON con referencias por UUID
- **Pipeline integrado** — la salida de una herramienta es entrada de otra

## Dependencias entre herramientas

```
   Material Creator ──→   Texture Painter ──→   Voxel Modeler ──┐
   (con tags)                                                     │
      │                                                          │
      ▼                                                          │
   Structure Designer ───────────────────────────────────────────┤
      │                                                          │
      ▼                                                          │
   Biome / Culture Editor ───────────────────────────────────────┤
      │                                                          │
      ▼                                                          │
   World Generator ──────────────────────────────────────────────┤
                                                                 │
                           HUD Editor ───────────────────────────┤
                           Input Mapper ─────────────────────────┤
                                                                ↓
                                                           Studio
```

| Herramienta | Produce | Consume de |
|---|---|---|
| **Material Creator** | Material (color, roughness, metalness, mapas, tags) | — |
| **Texture Painter** | Textura (imagen PNG + normal map) | Material (como pinceles) |
| **Voxel Modeler** | Modelo (malla primitivas + materiales) | Material (por primitiva) |
| **Structure Designer** | Plantilla de estructura (geometría procedural + tags) | Material (tags: muro, techo, ventana, piso, camino) |
| **Biome / Culture Editor** | Bioma / Cultura (paletas de materiales y variantes geométricas) | Material, Structure Designer |
| **World Generator** | Mundo procedural (biomas + estructuras + terreno) | Biome Editor, Structure Designer |
| **HUD Editor** | HUD (layout de UI con bars/text/image/button) | Textures, Input Maps |
| **Input Mapper** | Input Map (bindings tecla→acción) | — |
| **Studio** | Mapa (modelos posicionados en escenas) | Modelo + Material + HUD |

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

Tipos de recursos: `materials`, `textures`, `models`, `maps`, `huds`, `inputMaps`, `structures`, `biomes`.

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

### Plantilla de estructura
```json
{
  "id": "uuid",
  "name": "Casa pequeña",
  "tags": ["edificio", "vivienda"],
  "bounds": { "width": 6, "height": 5, "depth": 6 },
  "parts": [
    {
      "id": "uuid",
      "tag": "muro",
      "geometry": {
        "type": "box",
        "position": [0, 1.5, -2.5],
        "size": [6, 3, 1]
      },
      "collision": true,
      "variants": []
    },
    {
      "id": "uuid",
      "tag": "ventana",
      "geometry": {
        "type": "box",
        "position": [2, 1.5, -2.5],
        "size": [1, 1, 0.5]
      },
      "collision": false,
      "variants": ["cuadrada", "arco", "circular"]
    }
  ],
  "rules": {
    "minWidth": 4,
    "maxWidth": 8,
    "minHeight": 3,
    "maxHeight": 6
  }
}
```

### Bioma / Cultura
```json
{
  "id": "uuid",
  "name": "Bosque Templado",
  "type": "biome",
  "tags": ["bosque", "templado"],
  "palette": {
    "muro": { "materialId": "uuid-madera-roble", "variant": "" },
    "techo": { "materialId": "uuid-paja", "variant": "" },
    "piso": { "materialId": "uuid-baldosa-piedra", "variant": "" },
    "ventana": { "materialId": "uuid-madera-tallada", "variant": "cuadrada" },
    "camino": { "materialId": "uuid-tierra", "variant": "" }
  },
  "decorationSet": ["uuid-arbol-roble", "uuid-arbusto"],
  "climate": {
    "temperature": [0.4, 0.7],
    "humidity": [0.5, 0.9]
  }
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
├── maps/          → .json
├── structures/    → .json (plantillas de estructura)
└── biomes/        → .json (biomas / culturas)
```

## ResourcePicker

Todas las herramientas comparten un componente de navegación de recursos que permite:

- Explorar recursos por tipo (materiales, texturas, modelos, mapas, estructuras, biomas)
- Buscar por nombre
- Vista previa del recurso
- Arrastrar recursos entre herramientas



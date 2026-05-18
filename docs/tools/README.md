# Herramientas de desarrollo

## Visión general

Todas las herramientas comparten una arquitectura común:

- **Servidor único** — los recursos se almacenan en el servidor, accesibles desde cualquier herramienta
- **Formato común** — datos serializados en JSON con referencias por UUID
- **Pipeline integrado** — la salida de una herramienta es entrada de otra

## Dependencias entre herramientas

```
Material Creator        Texture Painter        Voxel Modeler
     │                        │                     │
     │  ┌─────────────────────┘                     │
     │  │  Textura (diffuse, normal, rough)          │
     │  │        ↑                                   │
     │  └────────┘                                   │
     │                                               │
     │  ┌─────────────────────────────────────────────┘
     │  │  Material (color, roughness, maps)           │
     └──┘                                             │
          ↓                                           │
     Studio ──────────────────────────────────────────┘
          ↓
       Juego
```

| Herramienta | Produce | Consume de |
|---|---|---|
| **Material Creator** | Material (color, roughness, metalness, mapas) | — |
| **Texture Painter** | Textura (imagen PNG + normal map) | Material (como pinceles) |
| **Voxel Modeler** | Modelo (malla voxel + asignación de materiales) | Material (por voxel/cara) |
| **Studio** | Mapa (modelos posicionados en el mundo) | Modelo + Material |

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

Tipos de recursos: `materials`, `textures`, `models`, `maps`.

## Estructura de datos

### Material
```json
{
  "id": "uuid",
  "name": "Piedra gris",
  "color": "#666666",
  "roughness": 0.8,
  "metalness": 0.1,
  "normalMapId": "uuid-de-textura"
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
  "voxels": [
    { "x": 0, "y": 0, "z": 0, "materialId": "uuid-material" }
  ],
  "size": [4, 4, 4]
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

# Tierra Media — Herramientas de desarrollo

## Próximas herramientas (por implementar)

| Herramienta | Prioridad | Depende de | Estado |
|---|---|---|---|
| **Material Creator — Tags** | Alta | — | Agregar sistema de tags/labels a materiales (ej: `muro`, `techo`, `piso`, `ventana`) |
| **Structure Designer** | Alta | Material Creator (tags) | Diseñador visual de plantillas de estructuras procedurales con partes etiquetadas |
| **Biome / Culture Editor** | Alta | Material Creator (tags), Structure Designer | Editor de biomas/culturas que definen paletas de materiales y variantes geométricas |
| **World Generator** | Media | Biome Editor, Structure Designer | Generación procedural de mundos desde biomas hacia arriba |
| **Studio** | Media | Voxel Modeler | Editor de mapas 3D (ya iniciado, pendiente de terminar) |

## Notas de diseño

- Enfoque **bottom-up**: primero estructuras → luego biomas → luego mundo.
- Las plantillas de estructuras usan **tags** en vez de materiales fijos.
- Los biomas/culturas resuelven los tags a materiales y variantes geométricas concretas.
- La distribución de estructuras es **prediseñada** (no procedural).

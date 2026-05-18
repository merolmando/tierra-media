# HUD Editor

Editor visual de Heads-Up Display para el juego.

## Funcionalidades

- **Canvas 2D**: preview escalado del HUD con resolución configurable (default 1920×1080)
- **Elementos**: Bar, Text, Image, Button — cada uno con propiedades completas
- **Drag**: reposicionar elementos arrastrándolos en el preview
- **Anchor**: 9 puntos de anclaje (top-left, center, bottom-right, etc.)
- **Propiedades**: posición, tamaño, colores, borde, opacidad, visibilidad
- **Textura**: selector de texturas para elementos Image y Button
- **Acción**: bindear botones a acciones del Input Mapper
- **Orden**: subir/bajar elementos en la capa de renderizado

## API

```
GET    /api/resources/huds           → lista HUDs
GET    /api/resources/huds/:id       → obtiene un HUD
POST   /api/resources/huds           → crea un HUD
PUT    /api/resources/huds/:id       → actualiza un HUD
DELETE /api/resources/huds/:id       → elimina un HUD
```

## Conexiones

- **Textures**: elementos Image y Button pueden cargar texturas existentes
- **Input Mapper**: botones pueden disparar acciones del Input Map

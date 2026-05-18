# Input Mapper

Gestor de bindings de teclas y botones para acciones del juego.

## Funcionalidades

- **17 acciones**: divididas en Movimiento (7), Acción (8) y Cámara (2)
- **Multi-binding**: varias teclas pueden disparar la misma acción
- **Grabación**: click en una tecla existente o en +, luego presionar la tecla deseada
- **Mouse**: bindear click izquierdo, derecho y medio como acciones
- **Detección de conflictos**: al asignar una tecla ya usada, se reasigna automáticamente
- **Defaults**: botón para restaurar WASD + controles típicos
- **CRUD**: guardar/cargar/eliminar múltiples configuraciones

## API

```
GET    /api/resources/inputMaps           → lista input maps
GET    /api/resources/inputMaps/:id       → obtiene un input map
POST   /api/resources/inputMaps           → crea un input map
PUT    /api/resources/inputMaps/:id       → actualiza un input map
DELETE /api/resources/inputMaps/:id       → elimina un input map
```

## Acciones disponibles

| Acción | Descripción | Default |
|---|---|---|
| `move_forward` | Avanzar | W |
| `move_backward` | Retroceder | S |
| `move_left` | Izquierda | A |
| `move_right` | Derecha | D |
| `jump` | Saltar | Espacio |
| `crouch` | Agacharse | Ctrl |
| `sprint` | Correr | Shift |
| `interact` | Interactuar | E |
| `attack` | Atacar | Click izq |
| `block` | Bloquear | Click der |
| `use_item` | Usar objeto | Q |
| `inventory` | Inventario | I |
| `pause` | Pausa | Esc |
| `menu` | Menú | Tab |
| `toggle_map` | Mapa | M |
| `zoom_in` | Zoom + | = |
| `zoom_out` | Zoom - | - |

## Conexiones

- **HUD Editor**: botones del HUD pueden referenciar acciones por nombre

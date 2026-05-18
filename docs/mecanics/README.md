# Mecánicas del juego

## Visión general

Las mecánicas definen las reglas e interacciones del juego. Cada mecánica es un módulo independiente que se comunica con el motor gráfico y con otras mecánicas a través de eventos y estado compartido.

## Arquitectura

Todas las mecánicas comparten:

- **Event bus** — comunicación desacoplada entre mecánicas
- **Game state** — estado global del juego (posición, inventario, stats)
- **API de recursos** — acceso a materiales, texturas, modelos (ver `docs/tools/README.md`)
- **Motor gráfico** — renderizado, cámaras, raycasting (ver `docs/engine/README.md`)

## Mecánicas planeadas

| Mecánica | Descripción | Estado |
|---|---|---|
| **Movimiento** | Desplazamiento del jugador (WASD + mouse) y física básica | Pendiente |
| **Combate** | Sistema de daño, armas, enemigos | Pendiente |
| **Inventario** | Recolección, almacenamiento y uso de objetos | Pendiente |
| **Crafteo** | Creación de objetos a partir de materiales | Pendiente |
| **Interacción** | Acción sobre objetos del mundo (abrir, recoger, activar) | Pendiente |
| **NPC** | Comportamiento básico de personajes no jugadores | Pendiente |

## Archivos fuente

- `src/game/` — carpeta raíz de mecánicas

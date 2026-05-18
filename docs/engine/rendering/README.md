# Renderizado

## Escena

- Fondo: color sólido `#1a1a2e`
- Tone mapping: ACESFilmic
- Exposición: 1

## Luces

| Tipo | Color | Intensidad | Sombra |
|---|---|---|---|
| Ambient | `#404060` | 0.5 | No |
| Direccional (principal) | `#ffeedd` | 2 | Sí (mapa 1024×1024, PCFSoft) |
| Direccional (relleno) | `#4488ff` | 0.5 | No |

- La luz direccional principal se controla desde el HUD (slider 0–360°), rota alrededor del eje Y.

## Renderer

- Antialiasing activado
- Pixel ratio: máx. 2
- Shadow map: PCFSoftShadowMap
- Se redimensiona con `container.clientWidth / clientHeight`

## Archivo

`src/engine/scene.js`

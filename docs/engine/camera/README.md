# Cámara

## Sistema de cámaras

- 6 presets intercambiables desde el HUD:
  - Perspectiva, Top-down, Frontal, Lateral izq., Lateral der., Trasera
- Cada preset tiene una posición fija relativa al target
- Todas son `PerspectiveCamera` (FOV 50, near 0.1, far 500)

## Controles

| Acción | Comportamiento |
|---|---|
| Arrastrar | Pan (desplaza target y cámara en el plano de vista) |
| Ctrl + arrastrar | Órbita (gira alrededor del target) |
| Rueda | Zoom (distancia 2–30) |
| Click sin arrastrar | Selecciona objeto bajo el cursor |

## Zoom

- Zoom in/out con rueda del mouse (deltaY)
- Distancia mínima: 2, máxima: 30
- La cámara se acerca/aleja del target manteniendo orientación

## Archivo

`src/engine/camera.js`

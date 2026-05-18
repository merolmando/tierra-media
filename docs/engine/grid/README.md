# Grid

## GridHelper

- GridHelper 20×20
- Color de líneas: `#444466` y `#333355`
- Posición en Y=0 (suelo)

## Ejes XYZ

- **X** (rojo `#ff4444`) → derecha
- **Y** (verde `#44ff44`) → arriba
- **Z** (azul `#4444ff`) → profundidad
- Cada eje tiene un `ArrowHelper` con cono en la punta
- Labels X, Y, Z como `Sprite` con `CanvasTexture`

## Archivo

`src/engine/grid.js`

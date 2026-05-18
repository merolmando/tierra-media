# Raycaster / Selección

## Funcionamiento

- Click sin arrastrar sobre un objeto → se selecciona
- Click sin arrastrar en espacio vacío → se deselecciona
- El objeto seleccionado se resalta con emisivo `#444466`
- La órbita se re-centra automáticamente en el objeto seleccionado

## Coordenadas

- Usa `canvas.getBoundingClientRect()` para calcular coordenadas normalizadas
- Relativas al área visible del canvas, no a la ventana

## Archivo

`src/engine/raycaster.js`

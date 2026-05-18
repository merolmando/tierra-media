# Tierra Media

> Hacer mi juego, pero que cualquiera pueda tomar lo que hice y modificarlo para hacer sus propias historias.

## Identidad

- Juego RPG sandbox web-based (se corre en servidor, se accede desde el navegador).
- Exploración y descubrimiento de mecánicas como núcleo.
- Singleplayer y multiplayer (con login de personaje).
- El jugador elige su camino: no hay clases fijas, el sistema de clases y profesiones es mezclable por decisión del usuario.

## Estilo visual

- Mundo 3D, estilo **voxel / low-poly** (baja demanda de recursos, el detalle está en otras áreas).
- Cámara: soporte para **primera persona** e **isométrica** (el jugador puede alternar).

## Mundo

- **Mundo continuo** (open world), sin pantallas de carga entre zonas.
- Tamaño tentativo: **100–500 chunks cuadrados** (ajustable cuando el juego funcione).
- Estructuras (mazmorras, edificios) tienen **instancias propias interiores**.
- Los "niveles de detalle" (chunks, LoD) son internos del motor — el jugador no los ve.

### Tres niveles de escala

| Nivel | Descripción | Propósito | Generación |
|---|---|---|---|
| **Macromapa** | Mapa general grande, cada tile representa una zona | Climas, eventos a gran escala | Reglas de biomas y terreno según ubicación (montañas, mares, volcanes, etc.) |
| **Zona** | Compuesta de estancias (rooms) | Eventos e interacciones de zona | Toma el tile base del macromapa + reglas de creación: fronteras, tribus, grupos de animales y bestias |
| **Estancia** | Mapa donde está el jugador; se mueve de una a otra por conexiones | Gameplay inmediato | Reglas de diseño propias de la zona |

### Coherencia

- La generación está dividida pero es **coherente**: si el jugador se transporta a un punto aleatorio del mundo, el mapa generado tiene sentido contextual (mismo bioma, misma lógica de zona).
- Solo se genera el mapa donde está el jugador y los **inmediatos** (evita saturar).
- Los mapas/zonas son grandes pero manejables (medidos en chunks).

### Técnico

- Todo se genera en **chunks de 8×8×8**.
- Esfera de renderizado y carga alrededor del jugador (evita saturar memoria).
- Los chunks frente al jugador se renderizan en distintos LOD según distancia (1, 0.8, 0.6, 0.4…).
- Los mapas de estancia definen conexiones a otras estancias.

## Controles y cámara

| Modo | Movimiento | Cámara | Interacción |
|---|---|---|---|
| **Primera persona** | WASD | Mouse (free look) | Click donde apunta la mira |
| **Isométrico** | WASD | Fija, el mouse se usa para apuntar | Click contextual según objeto/herramienta en mano y hacia dónde mira el personaje |

- La transición entre modos la maneja el HUD. No hay que diseñarla ahora.

## Personaje

### Nuevo jugador

- Al crear un personaje, el jugador **elige un reino o facción**.
- Aparece en la **aldea de principiantes** de esa facción.

### Stats base (versión mínima)

| Stat | Descripción |
|---|---|
| **Vida (HP)** | Salud del personaje |
| **Fuerza** | Daño físico, capacidad de carga, etc. |
| **Velocidad** | Movimiento, reflejos |
| **Hambre** | Degrada con el tiempo, afecta rendimiento |
| **Energía / Cansancio** | Se gasta al actuar, se recupera descansando |

Más stats se desbloquean mediante eventos o evolución del personaje.

### Progresión

- El personaje sube de nivel con **experiencia** (máx. nivel 100).
- Al subir nivel, el jugador puede invertirlo en: **clase**, **trabajo/profesión**, o **subclase**.
- Cada clase / trabajo / subclase tiene un máximo de **nivel 10**.
- El sistema es mezclable: el jugador decide cómo distribuir sus niveles.

### Clases, Trabajos y Subclases

| Tipo | Cómo se obtiene | Qué aporta | Ejemplo |
|---|---|---|---|
| **Clase** | Requisitos previos (stats, otras clases, misiones) | Habilidades activas, producción de elementos especiales | Mago → produce elementos mágicos |
| **Trabajo / Profesión** | Eventos con NPCs | Resistencias, habilidades pasivas, bonos de oficio | Aventurero → resistencias |
| **Subclase** | Especialización de una clase | Refina y potencia la clase base | — |

- El **aldeano** es la base: puede acceder a todo en nivel básico (usar cualquier arma, pescar, cultivar, magia nivel 0).
- Las habilidades que requieren cierto nivel de clase/trabajo no están disponibles sin él.

### Magia y Habilidades

- El nivel de clase/trabajo determina qué habilidades podés usar (ej. Mago nivel 2 → puede usar todos los hechizos de nivel 2).
- Pero para usar una habilidad, el personaje primero debe **conocerla** (está en su repertorio).
- Cada nivel te da **X cantidad de espacios** para elegir habilidades entre las que tu personaje conoce.
- Para que el personaje conozca una habilidad, necesita **aprenderla**: leyendo pergaminos, libros, entrenando con NPCs, etc.
- Ejemplo: leer un pergamino de Magia de Fuego desbloquea esa magia para tu personaje.

## Combate

- Click para atacar (no automático). Más adelante habrá botones de habilidades, pero en la versión inicial solo click.
- El arma tiene **colisión** (hitbox): si la hitbox del arma conecta con el enemigo, hay daño.
- Los cuerpos tienen **cajas de colisión por partes** (cabeza, torso, extremidades, etc.). La zona impactada afecta el daño recibido.
- **Cálculo base**: daño del arma × fuerza del personaje − resistencia / armadura de la zona impactada.
- Clases y habilidades pueden modificar estos valores.

## Inventario

- El personaje tiene un **inventario tipo lista** con capacidad limitada por **peso** y **tamaño** de los objetos.
- **Dos manos**, cada una puede sostener hasta **3 objetos** (slots rápidos intercambiables).
- Se puede cambiar fácilmente entre los objetos de cada mano.
- Solo se puede **usar un objeto por mano** a la vez (no usar dos objetos en la misma mano simultáneamente).

## Objetos / Items

| Tipo | Descripción |
|---|---|
| **Materiales** | Recursos básicos del mundo (madera, piedra, hierro, etc.) |
| **Consumibles** | Se gastan al usarlos (comida, pociones) |
| **Objetos** | Con durabilidad (herramientas, armas, armadura) |
| **Premateriales** | Materiales procesados/refinados (tablones, lingotes) |
| **Mochilas / inventarios portátiles** | Expanden la capacidad de carga |
| **Mixtos** | Combinan categorías (ej. objeto que también es contenedor) |

## Construcción

- El **terreno/mundo es estático** (no se modifica).
- Las **estructuras son modificables**: el jugador puede colocar campamentos, edificios, cultivos, etc. como superposiciones sobre el mundo.
- Algunas estructuras son solo decorativas/visuales; otras tienen **acceso a estancias interiores** (mini-mapas dentro de la estructura).
- Escala de modificabilidad: construir una casa es viable; destruir un castillo es inviable (o requiere mucho esfuerzo).

## NPCs / Criaturas

Sistema modular: el tipo de cuerpo determina qué animaciones y ataques tiene disponible la criatura.

| Tipo base | Animaciones | Ataques |
|---|---|---|
| **Humanoide** | Caminar, correr, hablar, usar herramientas | Armas cuerpo a cuerpo y distancia, según objeto en mano |
| **Bestia perro** | Cuadrúpedo, correr, saltar | Mordisco, embestida |
| **Bestia alada** | Volar, planear, aterrizar | Ataque aéreo, picado |
| **Bestia serpiente** | Reptar, enrollarse | Constricción, veneno |
| **Amorfo** | Desplazarse, fundirse | Absorber, dividirse |

## Multiplayer / Red

- Los jugadores en una misma estancia **se ven en tiempo real** y pueden interactuar entre sí.
- Cada personaje es una **cuenta** vinculada a un servidor (nodo).
- **Autoridad**: el servidor a cargo del mapa maneja todo (posiciones, acciones, combate) dentro de esa estancia.
- El personaje puede migrar de dos formas:
  1. **Entre mundos** — moverse entre estancias conectadas dentro del mismo servidor.
  2. **Entre nodos** — moverse entre servidores distintos; los datos del personaje se migran al nodo destino.
- Los servidores se comunican entre sí para sincronizar datos cuando un jugador se mueve de un nodo a otro.
- La sincronización no es constante para evitar saturación: ocurre **periódicamente** o **solo cuando hay cambios**.
- Los datos del personaje persisten independientemente del nodo: si un jugador cierra sesión en el nodo B y su propio nodo A está apagado, al conectarse desde el nodo B su personaje sigue intacto.

## Crafting

- La mayoría del crafting se hace en **mesas de trabajo**.
- Algunas recetas básicas se pueden hacer **en el inventario** (sin mesa).
- Ciertas recetas requieren **profesiones o clases específicas** para poder usarse.

## Eventos y Misiones

| | Qué es | Cómo se desencadena | Consecuencia |
|---|---|---|---|
| **Evento** | Algo que pasa en el mundo (climático, social, mágico, etc.) | Condiciones del mundo + acciones del jugador (o sin él) | Genera cambios en el mundo (nuevos recursos, NPCs, zonas alteradas) |
| **Misón** | Tarea o lista de tareas con recompensa | Objetos, NPCs | Recompensa (items, XP, acceso a algo) |

- Una **misión puede provocar un evento** (ej. matar a cierto NPC desencadena una guerra de facciones).
- Un **evento nunca inicia misiones** directamente (los eventos ocurren, las misiones las toma el jugador).

## Economía

- Monedas como medio de intercambio.
- La cantidad de monedas en circulación es **fija por servidor** y distinta en cada uno.
- Los precios de objetos y materiales se establecen según **proximidad a la fuente** (oferta y demanda geográfica):
  - El pescado es caro en la montaña, barato en el puerto.
  - El mineral es barato en la mina de la montaña, caro en el puerto.

## Herramientas de Desarrollo (Modding Tools)

| Herramienta | Estado | Propósito |
|---|---|---|
| **Material Creator** | ✅ Existe | Crear materiales PBR (colores, texturas, propiedades mecánicas) |
| **Texture Painter** | ✅ Existe | Editar texturas (atlas) usando materiales como pinceles |
| **Voxel Modeler** | ⚠️ En desarrollo | Modelado 3D voxel: crear objetos, edificios, props |
| **Studio** | ⚠️ Existe (básico) | Editor de mapas 3D: colocar modelos en el mundo |
| **Animation / Rigging** | ❌ Pendiente | Añadir huesos a modelos voxel y definir animaciones |
| **Editor de NPCs** | ❌ Pendiente | Crear plantillas de NPCs: stats, lógica, comportamiento |
| **Editor de Mapas Proc.** | ❌ Pendiente | Diseñar biomas, estructuras y reglas de generación procedural |
| **Editor de HUD/UI** | ❌ Pendiente | Crear interfaces, transiciones, overlays |
| **Editor de Items/Recetas** | ❌ Pendiente | Definir objetos, materiales, recetas de crafting |
| **Creador de Tiles** | ⏳ Pendiente | Editor de tiles pixel-art con pincel, línea, bote y capas multi-frame |
| **Cortador de Texturas** | ❌ Pendiente | Subir spritesheets, seleccionar rectángulos y guardar como entidades |
| **Baker de Luz** | ❌ Pendiente | Horneado de lightmap GPU para iluminación realista |
| **Gestor de Entidades** | ❌ Pendiente | Administrar sprites, animaciones, emisores y propiedades |
| **Visor de Atlas** | ❌ Pendiente | Visualizar el atlas de sprites completo |

### Pipeline de producción

```
Material Creator ──→ Texture Painter ──→ Voxel Modeler ──→ Studio ──→ JUEGO
                        ↓                     ↓
                   Texturas (PBR)        Modelos + Huesos
                                             ↓
                                       Animation / Rigging
                                             ↓
                                       Editor de NPCs
                                             ↓
                                       Editor de Mapas Proc.

Editor de Items ───→ define objetos y recetas que se usan en todo el pipeline
Editor de HUD ─────→ define la interfaz del juego final
```

## Primera versión jugable

El jugador empieza como **aldeano** con capacidades básicas:
- Moverse por el mundo.
- Luchar (mecánica básica de combate).
- A partir de ahí, el jugador decide su rumbo: aventurero, granjero, comerciante, artesano, etc.

*(Este README se va a ir refinando pregunta por pregunta, sin adelantar módulos.)*

## Plan de desarrollo

### Etapa 1 — Fundación

**Hito 0 — Estructura del proyecto**
- Migrar server.js a Express con rutas separadas por dominio
- Setup Vite para frontend (dev server con HMR, build)
- Organizar src/ en server/, client/, shared/
- Scripts dev, build, start
- Limpiar dependencias legacy

### Etapa 2 — Gráficos y Herramientas

**Hito 1 — Núcleo gráfico**
- Escena Three.js con cámara orbital y primera persona
- Luces (ambient, direccional), grid de referencia
- Raycasting / selección básica
- Render de geometría simple

**Hito 2 — Herramientas de desarrollo**
- Voxel Modeler (modelado 3D voxel con materiales PBR)
- Studio (editor de mapas 3D, colocar modelos en escena)
- Texture Painter (pintar atlas de texturas con materiales)
- Material Creator (crear materiales)

### Etapa 3 — Juego

**Hito 3 — Motor del juego**
- Sistema de chunks 8×8×8 con carga/descarga dinámica
- Esfera de render y LOD por distancia
- Generación procedural de terreno (macromapa → chunks coherentes)
- Colisión voxel, gravedad, salto
- Input del jugador (WASD + mouse look)

*(Próximos hitos a definir)*

# Sistema

## Visión general

Arquitectura cliente-servidor con SPA vanilla y API REST. El servidor sirve archivos estáticos y expone endpoints para recursos de herramientas y documentación.

## Flujo request/respuesta

```
Browser → hash router → page component
    │
    ├──→ fetch /api/* → Express → JSON
    ├──→ fetch docs/  → Express → markdown
    └──→ output       → DOM
```

## Frontend

Aplicación SPA vanilla JS con Vite 8 como bundler + HMR en desarrollo.

| Componente | Descripción |
|---|---|
| **Router** (`router.js`) | Hash routing con soporte para rutas anidadas (`#/docs/engine/camera`) |
| **Páginas** (`pages/`) | Inicio, Devlog, Juego, Desarrollo, Documentación |
| **HUD** (`pages/game.js`) | Controles de cámara, slider de luz, brújula |

Más detalles en `docs/system/web/README.md`.

## Backend

Servidor Express 5 con Node.js.

| Endpoint | Método | Descripción |
|---|---|---|
| `GET /api/health` | — | Health check |
| `GET /api/devlog` | — | Historial de cambios |
| `GET /api/docs/*` | — | Archivos markdown desde `docs/` |
| `GET /api/docs/tree` | — | Árbol de documentación |
| `GET /api/resources` | — | Lista tipos de recursos |
| `GET /api/resources/:type` | — | Lista recursos por tipo |
| `GET /api/resources/:type/:id` | — | Obtiene recurso |
| `POST /api/resources/:type` | — | Crea recurso |
| `PUT /api/resources/:type/:id` | — | Actualiza recurso |
| `DELETE /api/resources/:type/:id` | — | Elimina recurso |

Recursos estáticos servidos desde `dist/` (build de Vite). Catch-all SPA para cualquier ruta no-API sirve `index.html`.

Más detalles en `docs/system/server/README.md`.

## Pipeline de build

```
src/client/ ──→ Vite build ──→ dist/ (estáticos)
src/server/ ──→ Node.js     ──→ Servidor
```

## Archivos fuente

- `src/server/index.js` — entry point + rutas
- `src/server/routes/health.js` — ruta de salud
- `src/server/routes/resources.js` — CRUD de recursos
- `src/client/router.js` — hash router
- `src/client/pages/` — componentes de página
- `src/client/styles/` — estilos CSS

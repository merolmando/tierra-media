# Servidor

## Tecnología

- Express 5
- Node.js 25
- Sirve archivos estáticos desde `dist/` (build de Vite)
- Catch-all SPA: cualquier ruta no-API sirve `index.html`

## API

| Endpoint | Respuesta |
|---|---|
| `GET /api/health` | `{"status":"ok"}` |
| `GET /api/devlog` | Array JSON del historial de cambios |
| `GET /api/docs/*` | Archivo markdown desde `docs/` |

## Archivos

`src/server/index.js` — entry point + rutas
`src/server/routes/health.js` — ruta de salud

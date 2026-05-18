const tools = [
  { name: 'Material Creator', desc: 'Crear materiales PBR con colores, texturas y propiedades mecánicas', route: '/dev/material-creator', status: 'ready' },
  { name: 'Voxel Modeler', desc: 'Modelado 3D voxel para crear objetos, edificios y props', route: '/dev/voxel-modeler', status: 'ready' },
  { name: 'Texture Painter', desc: 'Editar texturas atlas y normal maps usando materiales como pinceles', route: '/dev/texture-painter', status: 'ready' },
  { name: 'HUD Editor', desc: 'Editor de HUDs con botones, bars y elementos de UI', route: '/dev/hud-editor', status: 'ready' },
  { name: 'Input Mapper', desc: 'Mapeo de teclas y botones para acciones del juego', route: '/dev/input-mapper', status: 'ready' },
  { name: 'Studio', desc: 'Editor de mapas 3D para colocar modelos en el mundo', route: null, status: 'pending' },
]

export function renderDev() {
  const app = document.getElementById('app')
  app.innerHTML = `
    <h1>Desarrollo</h1>
    <p style="margin-bottom:20px;color:#888">Herramientas de modding en desarrollo.</p>
    <div class="tool-grid">
      ${tools.map(t => {
        const statusClass = t.status === 'ready' ? 'status-ready' : 'status-pending'
        const statusLabel = t.status === 'ready' ? '✅ Disponible' : '⏳ Próximamente'
        const content = `
          <span class="status ${statusClass}">${statusLabel}</span>
          <h3>${t.name}</h3>
          <p>${t.desc}</p>
        `
        if (t.route) {
          return `<a href="#${t.route}" class="tool-card" style="text-decoration:none;display:block">${content}</a>`
        }
        return `<div class="tool-card">${content}</div>`
      }).join('')}
    </div>
  `
}

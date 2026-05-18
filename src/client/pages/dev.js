const tools = [
  { name: 'Voxel Modeler', desc: 'Modelado 3D voxel para crear objetos, edificios y props' },
  { name: 'Material Creator', desc: 'Crear materiales PBR con colores, texturas y propiedades mecánicas' },
  { name: 'Texture Painter', desc: 'Editar texturas atlas y normal maps usando materiales como pinceles' },
  { name: 'Studio', desc: 'Editor de mapas 3D para colocar modelos en el mundo' },
]

export function renderDev() {
  const app = document.getElementById('app')
  app.innerHTML = `
    <h1>Desarrollo</h1>
    <p style="margin-bottom:20px;color:#888">Herramientas de modding en desarrollo.</p>
    <div class="tool-grid">
      ${tools.map(t => `
        <div class="tool-card">
          <span class="status status-pending">⏳ Próximamente</span>
          <h3>${t.name}</h3>
          <p>${t.desc}</p>
        </div>
      `).join('')}
    </div>
  `
}

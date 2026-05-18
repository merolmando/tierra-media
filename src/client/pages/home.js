export function renderHome() {
  const app = document.getElementById('app')
  app.innerHTML = `
    <section class="hero">
      <h1>Tierra Media</h1>
      <p>Un RPG sandbox web-based de mundo abierto, exploración y descubrimiento.</p>
      <span class="status-badge alpha">Alpha — En desarrollo</span>
    </section>

    <section>
      <h2>¿Qué es Tierra Media?</h2>
      <p>
        Un juego de rol y sandbox al que se accede desde el navegador. 
        Mundo 3D voxel/low-poly continuo, generación procedural coherente 
        en tres niveles de escala, y un sistema de clases y profesiones 
        mezclable donde <strong>tú decides tu camino</strong>.
      </p>
      <p>
        No hay clases fijas: el sistema es completamente modular. 
        Querés ser un mago herrero que cultiva en la montaña? Podés.
        Exploración y descubrimiento de mecánicas como núcleo del juego.
      </p>
    </section>

    <section>
      <h2>Estado actual</h2>
      <p>
        Proyecto en etapa de fundación. El motor gráfico base con Three.js 
        está funcionando (escena 3D, luces, grid). El servidor Express 
        con rutas separadas está listo. Próximo paso: herramientas de desarrollo 
        y sistema de chunks.
      </p>
    </section>

    <section>
      <h2>Últimos cambios</h2>
      <div id="latest-devlog"></div>
    </section>
  `

  fetch('/api/devlog')
    .then(r => r.json())
    .then(data => {
      const container = document.getElementById('latest-devlog')
      const latest = data.slice(-1)
      container.innerHTML = latest.map(e => `
        <div class="devlog-entry open">
          <div class="devlog-header">
            <span><strong>${e.title}</strong> <span class="date">${e.date}</span></span>
          </div>
          <div class="devlog-body" style="max-height:2000px;padding:14px 18px">
            <ul>${e.entries.map(entry => `<li>${entry}</li>`).join('')}</ul>
          </div>
        </div>
      `).join('')
    })
}

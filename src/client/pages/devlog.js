export function renderDevlog() {
  const app = document.getElementById('app')
  app.innerHTML = '<h1>Devlog</h1><p>Cargando...</p>'

  fetch('/api/devlog')
    .then(r => r.json())
    .then(data => {
      const html = data.toReversed().map(e => `
        <div class="devlog-entry">
          <div class="devlog-header" onclick="this.parentElement.classList.toggle('open')">
            <span><strong>${e.title}</strong> <span class="date">${e.date}</span></span>
            <span class="arrow">▶</span>
          </div>
          <div class="devlog-body">
            <ul>${e.entries.map(entry => `<li>${entry}</li>`).join('')}</ul>
          </div>
        </div>
      `).join('')

      app.innerHTML = `
        <h1>Devlog</h1>
        <p style="margin-bottom:20px;color:#888">
          Historial de cambios del proyecto. Siempre append, nunca se borra.
        </p>
        ${html}
      `
    })
    .catch(() => {
      app.innerHTML = '<h1>Devlog</h1><p>Error al cargar el devlog.</p>'
    })
}

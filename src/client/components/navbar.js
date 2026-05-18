const links = [
  { href: '#/', label: 'Inicio' },
  { href: '#/devlog', label: 'Devlog' },
  { href: '#/game', label: 'Juego' },
  { href: '#/dev', label: 'Desarrollo' },
  { href: '#/docs', label: 'Documentación' },
]

export function renderNavbar() {
  const nav = document.querySelector('nav')
  nav.innerHTML = links
    .map(l => `<a href="${l.href}" data-route="${l.href.slice(1)}">${l.label}</a>`)
    .join('')
  highlightActive()
  window.addEventListener('hashchange', highlightActive)
}

function highlightActive() {
  const hash = location.hash.slice(1) || '/'
  document.querySelectorAll('nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.route === hash)
  })
}

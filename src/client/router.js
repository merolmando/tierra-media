export class Router {
  constructor(routes, docsHandler) {
    this.routes = routes
    this.docsHandler = docsHandler
    this.beforeChange = null
    window.addEventListener('hashchange', () => this.resolve())
  }

  onBeforeChange(cb) {
    this.beforeChange = cb
  }

  resolve() {
    if (this.beforeChange) this.beforeChange()

    const hash = location.hash.slice(1) || '/'

    if (hash === '/docs' || hash.startsWith('/docs/')) {
      const path = hash === '/docs' ? '' : hash.replace('/docs/', '')
      if (this.docsHandler) this.docsHandler(path)
      return
    }

    const route = this.routes[hash]
    if (route) route()
    else if (this.routes['/']) this.routes['/']()
  }

  init() {
    this.resolve()
  }
}

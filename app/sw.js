// Service worker mínimo: sin ÉL, Chrome/Android no considera la página
// "instalable" (el manifest.json por sí solo no basta) aunque cumpla todo lo
// demás. No cachea nada a propósito — el objetivo aquí es solo la
// instalación como app, no soporte offline.
self.addEventListener('fetch', () => {})

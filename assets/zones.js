// Definición de las zonas de lanzamiento y de portería, en espejo exacto con
// la app VideoCuts (src/renderer/src/pages/Editor/shotZones.json y
// GoalZonePicker.tsx) — así el mapa de calor de la web usa la misma
// geometría que el selector con el que se clasificó cada jugada.

export const COURT_W = 797
export const COURT_H = 816

export const SHOT_ZONES = [
  { code: '1', name: 'Extremo izquierdo cerrado', points: [{ x: 0, y: 24 }, { x: 94, y: 24 }, { x: 119, y: 115 }, { x: 0, y: 116 }] },
  { code: '2', name: 'Extremo izquierdo abierto', points: [{ x: 119, y: 115 }, { x: 176, y: 195 }, { x: 210, y: 218 }, { x: 0, y: 230 }, { x: 0, y: 116 }] },
  { code: '3', name: 'Lateral izquierdo interior', points: [{ x: 210, y: 218 }, { x: 272, y: 249 }, { x: 273, y: 379 }, { x: 186, y: 353 }, { x: 141, y: 325 }, { x: 87, y: 283 }, { x: 41, y: 228 }] },
  { code: '4', name: 'Lateral izquierdo exterior', points: [{ x: 273, y: 379 }, { x: 186, y: 353 }, { x: 109, y: 300 }, { x: 41, y: 228 }, { x: 0, y: 230 }, { x: 0, y: 816 }, { x: 268, y: 816 }] },
  { code: '5', name: 'Central interior', points: [{ x: 272, y: 249 }, { x: 273, y: 379 }, { x: 356, y: 388 }, { x: 530, y: 380 }, { x: 531, y: 246 }, { x: 481, y: 254 }, { x: 316, y: 256 }] },
  { code: '6', name: 'Central exterior', points: [{ x: 530, y: 380 }, { x: 338, y: 389 }, { x: 273, y: 379 }, { x: 268, y: 816 }, { x: 534, y: 816 }] },
  { code: '7', name: 'Lateral derecho interior', points: [{ x: 756, y: 228 }, { x: 710, y: 283 }, { x: 656, y: 325 }, { x: 611, y: 353 }, { x: 530, y: 380 }, { x: 531, y: 246 }, { x: 587, y: 218 }] },
  { code: '8', name: 'Lateral derecho exterior', points: [{ x: 534, y: 816 }, { x: 797, y: 816 }, { x: 797, y: 230 }, { x: 756, y: 228 }, { x: 688, y: 300 }, { x: 611, y: 353 }, { x: 530, y: 380 }] },
  { code: '9', name: 'Extremo derecho abierto', points: [{ x: 797, y: 116 }, { x: 797, y: 230 }, { x: 587, y: 218 }, { x: 621, y: 195 }, { x: 678, y: 115 }] },
  { code: '10', name: 'Extremo derecho cerrado', points: [{ x: 797, y: 116 }, { x: 678, y: 115 }, { x: 703, y: 24 }, { x: 797, y: 24 }] },
  { code: '11', name: 'Pivote izquierda', points: [{ x: 94, y: 24 }, { x: 119, y: 115 }, { x: 176, y: 195 }, { x: 210, y: 218 }, { x: 272, y: 249 }, { x: 272, y: 24 }] },
  { code: '12', name: 'Pivote centro', points: [{ x: 272, y: 249 }, { x: 316, y: 256 }, { x: 481, y: 254 }, { x: 531, y: 246 }, { x: 531, y: 24 }, { x: 272, y: 24 }] },
  { code: '13', name: 'Pivote derecha', points: [{ x: 531, y: 246 }, { x: 587, y: 218 }, { x: 621, y: 195 }, { x: 678, y: 115 }, { x: 703, y: 24 }, { x: 531, y: 24 }] }
]

export const GOAL_INNER_ZONES = [
  'top-left', 'top-center', 'top-right',
  'mid-left', 'mid-center', 'mid-right',
  'bottom-left', 'bottom-center', 'bottom-right'
]

export const GOAL_LABELS = {
  'top-left': 'Arriba derecha', 'top-center': 'Arriba centro', 'top-right': 'Arriba izquierda',
  'mid-left': 'Medio derecha', 'mid-center': 'Medio centro', 'mid-right': 'Medio izquierda',
  'bottom-left': 'Abajo derecha', 'bottom-center': 'Abajo centro', 'bottom-right': 'Abajo izquierda',
  'out-top': 'Fuera arriba', 'out-left': 'Fuera derecha', 'out-right': 'Fuera izquierda'
}

export const GOAL_LAYOUT = { cols: 3, cellW: 52, cellH: 38, post: 6, outSide: 30, outTop: 26 }

function pts(points) {
  return points.map((p) => `${p.x},${p.y}`).join(' ')
}

// Color de una zona según su intensidad relativa (0..1) sobre un acento
// dado; las seleccionadas llevan además un borde marcado.
function fillFor(intensity, accent, selected) {
  if (selected) return `${accent}aa`
  if (intensity <= 0) return '#1c1c1c'
  const alpha = Math.round((18 + intensity * 70) * 2.55).toString(16).padStart(2, '0')
  return `${accent}${alpha}`
}

// Pinta el mapa de zonas de lanzamiento (13 zonas) dentro de `el`, coloreado
// según `counts` ({code: n}); `selected` es el array de códigos activos en el
// filtro y `onToggle(code)` se llama al hacer clic en una zona.
export function renderShotZoneMap(el, { counts, selected, onToggle, accent = '#3b82f6' }) {
  const max = Math.max(1, ...Object.values(counts))
  const polys = SHOT_ZONES.map((z) => {
    const n = counts[z.code] || 0
    const isSel = selected.includes(z.code)
    const fill = fillFor(n / max, accent, isSel)
    const cx = z.points.reduce((s, p) => s + p.x, 0) / z.points.length
    const cy = z.points.reduce((s, p) => s + p.y, 0) / z.points.length
    return `
      <g class="zone-shape" data-code="${z.code}" tabindex="0" role="button"
         aria-label="${z.name}: ${n}" aria-pressed="${isSel}">
        <polygon points="${pts(z.points)}" fill="${fill}"
          stroke="${isSel ? accent : '#333'}" stroke-width="${isSel ? 2.5 : 1}" />
        <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle"
          fill="${n > 0 ? '#fff' : '#555'}" font-size="26" font-weight="700"
          style="pointer-events:none">${n || ''}</text>
      </g>`
  }).join('')

  el.innerHTML = `<svg viewBox="0 0 ${COURT_W} ${COURT_H}" class="zone-svg">
      <image href="assets/half-court.png" x="0" y="0" width="${COURT_W}" height="${COURT_H}" />
      ${polys}
    </svg>`

  el.querySelectorAll('.zone-shape').forEach((g) => {
    const code = g.dataset.code
    const fire = () => onToggle(code)
    g.addEventListener('click', fire)
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire() } })
  })
}

// Pinta la rejilla de portería (3x3 + 3 franjas de fuera), misma geometría
// que GoalZonePicker.tsx en la app.
export function renderGoalZoneMap(el, { counts, selected, onToggle, accent = '#3b82f6' }) {
  const { cols, cellW, cellH, post, outSide, outTop } = GOAL_LAYOUT
  const gridW = cols * cellW
  const gridH = 3 * cellH
  const gridX = outSide + post
  const gridY = outTop + post
  const width = gridW + post * 2 + outSide * 2
  const height = gridH + post * 2 + outTop
  const max = Math.max(1, ...Object.values(counts))

  const cell = (zone, x, y, w, h) => {
    const n = counts[zone] || 0
    const isSel = selected.includes(zone)
    const fill = fillFor(n / max, accent, isSel)
    return `<g class="zone-shape" data-code="${zone}" tabindex="0" role="button"
        aria-label="${GOAL_LABELS[zone]}: ${n}" aria-pressed="${isSel}">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"
        stroke="${isSel ? accent : '#333'}" stroke-width="${isSel ? 2.5 : 1}" />
      <text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" dominant-baseline="middle"
        fill="${n > 0 ? '#fff' : '#555'}" font-size="13" font-weight="700"
        style="pointer-events:none">${n || ''}</text>
    </g>`
  }

  const inner = GOAL_INNER_ZONES.map((zone, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    return cell(zone, gridX + col * cellW, gridY + row * cellH, cellW, cellH)
  }).join('')

  el.innerHTML = `<svg viewBox="0 0 ${width} ${height}" class="zone-svg goal-svg">
      ${cell('out-top', gridX, 0, gridW, outTop)}
      ${cell('out-left', 0, gridY, outSide, gridH)}
      ${cell('out-right', gridX + gridW, gridY, outSide, gridH)}
      <rect x="${gridX - post / 2}" y="${gridY - post / 2}" width="${gridW + post}" height="${gridH + post}"
        fill="none" stroke="#666" stroke-width="${post}" />
      ${inner}
    </svg>`

  el.querySelectorAll('.zone-shape').forEach((g) => {
    const code = g.dataset.code
    const fire = () => onToggle(code)
    g.addEventListener('click', fire)
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire() } })
  })
}

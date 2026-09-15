import { SHOT_ZONES, GOAL_LABELS, renderShotZoneMap, renderGoalZoneMap } from './zones.js'

export const PERIOD_LABELS = { first: '1ª parte', second: '2ª parte', overtime: 'Prórroga' }

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

export async function fetchJSON(url) {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`No se pudo cargar ${url} (${res.status})`)
  return res.json()
}

export function formatDateEs(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function toggleInArray(arr, val) {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]
}

function uniqueSorted(events, pick) {
  const map = new Map()
  for (const e of events) {
    const v = pick(e)
    if (!v) continue
    map.set(v, (map.get(v) || 0) + 1)
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }))
}

// Como uniqueSorted, pero para campos multivaluados (jugadores implicados).
function uniqueSortedFlat(events, pickList, fallback) {
  const map = new Map()
  for (const e of events) {
    const list = pickList(e)
    if (!list || list.length === 0) {
      if (fallback) map.set(fallback, (map.get(fallback) || 0) + 1)
      continue
    }
    for (const v of list) map.set(v, (map.get(v) || 0) + 1)
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }))
}

// ─── App de un partido o de varios partidos combinados ────────────────────────
// `events` ya viene normalizado (ver matchExport.ts en la app): cada evento
// trae su propio matchId/matchName cuando se combinan varios partidos.
export function mountMatchApp(root, { events, showMatchFilter }) {
  const filters = { text: '', types: [], outcomes: [], periods: [], teams: [], players: [], zones: [], goalZones: [], matches: [] }

  root.innerHTML = `
    <div class="app-layout">
      <div class="app-main">
        <div class="panel filters">
          <div class="search-row">
            <input id="f-text" type="text" placeholder="Buscar (tipo, resultado, jugador, equipo...)" />
            <button class="clear-btn" id="f-clear">Limpiar filtros</button>
          </div>
          <div class="chip-group" id="f-types"></div>
          <div class="chip-group" id="f-outcomes"></div>
          <div class="chip-group" id="f-periods"></div>
          <div class="chip-group" id="f-teams"></div>
          <div class="chip-group" id="f-players"></div>
          ${showMatchFilter ? '<div class="chip-group" id="f-matches"></div>' : ''}
        </div>

        <div class="panel stat-headline" id="headline"></div>

        <div class="stats-grid">
          <div class="panel"><div class="panel-title">Lanzamientos por resultado</div><div id="barOutcome"></div></div>
          <div class="panel"><div class="panel-title">Lanzamientos por jugador</div><div id="barPlayer"></div></div>
          <div class="panel"><div class="panel-title">Zona de lanzamiento</div><div id="zoneMap"></div></div>
          <div class="panel"><div class="panel-title">Zona de portería</div><div id="goalMap"></div></div>
        </div>
      </div>

      <div class="app-sidebar">
        <div class="clip-count" id="clipCount"></div>
        <div class="clip-list" id="clipList"></div>
        <div class="player-wrap" id="playerWrap"><div class="placeholder">Elige un corte de la lista</div></div>
        <div class="detail" id="detail" style="display:none">
          <div class="title" id="detailTitle"></div>
          <div class="row2" id="detailSub"></div>
          <div class="row2" id="detailNotes"></div>
          <a class="open-link" id="detailLink" href="#" target="_blank" rel="noopener">Abrir en YouTube ↗</a>
        </div>
      </div>
    </div>`

  const $ = (sel) => root.querySelector(sel)
  let activeClipId = null

  function computeFiltered() {
    const q = filters.text.trim().toLowerCase()
    return events.filter((e) => {
      if (q) {
        const hay = [e.type, e.outcome, e.team, e.players, e.notes, e.matchName].join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (filters.types.length && !filters.types.includes(e.type)) return false
      if (filters.outcomes.length && !filters.outcomes.includes(e.outcome || 'Sin resultado')) return false
      if (filters.periods.length && !filters.periods.includes(e.period)) return false
      if (filters.teams.length && !filters.teams.includes(e.team)) return false
      if (filters.players.length && !(e.playersList || []).some((p) => filters.players.includes(p))) return false
      if (filters.zones.length && !filters.zones.includes(e.zone)) return false
      if (filters.goalZones.length && !filters.goalZones.includes(e.goalZone)) return false
      if (showMatchFilter && filters.matches.length && !filters.matches.includes(e.matchName)) return false
      return true
    })
  }

  function renderChipGroup(el, groupLabel, options, selected, onToggle) {
    el.innerHTML = `<span class="group-label">${escapeHtml(groupLabel)}</span>` + options.map(({ value, count }) => `
      <button type="button" class="chip ${selected.includes(value) ? 'active' : ''}" data-v="${escapeHtml(value)}">
        ${escapeHtml(value)} <span style="opacity:.55">(${count})</span>
      </button>`).join('')
    el.querySelectorAll('.chip').forEach((btn) => {
      btn.addEventListener('click', () => onToggle(btn.dataset.v))
    })
    el.style.display = options.length ? 'flex' : 'none'
  }

  function renderBarList(el, data, selected, onToggle, emptyLabel) {
    if (data.length === 0) { el.innerHTML = `<div class="bar-empty">${emptyLabel}</div>`; return }
    const max = Math.max(1, ...data.map((d) => d.count))
    el.innerHTML = data.map(({ value, count }) => `
      <div class="bar-row ${selected.includes(value) ? 'active' : ''}" data-v="${escapeHtml(value)}">
        <span class="label">${escapeHtml(value)}</span>
        <div class="track"><div class="fill" style="width:${(count / max) * 100}%"></div></div>
        <span class="n">${count}</span>
      </div>`).join('')
    el.querySelectorAll('.bar-row').forEach((row) => {
      row.addEventListener('click', () => onToggle(row.dataset.v))
    })
  }

  function renderClipRow(e) {
    const matchPrefix = showMatchFilter && e.matchName ? `${escapeHtml(e.matchName)} · ` : ''
    return `
      <div class="clip-row ${e.id === activeClipId ? 'active' : ''}" data-id="${e.id}">
        <div class="top">
          <span class="time">${e.absoluteTimeLabel}</span>
          <span class="badge" style="background:${e.color}"></span>
          <span class="type">${escapeHtml(e.type)}</span>
          ${e.outcome ? `<span class="outcome">${escapeHtml(e.outcome)}</span>` : ''}
        </div>
        ${(e.players || e.matchTime || matchPrefix) ? `<div class="sub">${matchPrefix}${[e.players, PERIOD_LABELS[e.period] || '', e.matchTime].filter(Boolean).join(' · ')}</div>` : ''}
        ${!e.youtubeId ? '<div class="unplayable">⚠ vídeo no disponible online</div>' : ''}
      </div>`
  }

  function selectClip(e) {
    activeClipId = e.id
    const wrap = $('#playerWrap')
    if (e.youtubeId) {
      const start = Math.max(0, Math.floor(e.start))
      const end = Math.ceil(e.end)
      wrap.innerHTML = `<iframe src="https://www.youtube.com/embed/${e.youtubeId}?start=${start}&end=${end}&autoplay=1&rel=0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`
    } else {
      wrap.innerHTML = '<div class="placeholder">Este vídeo no tiene URL de YouTube asignada.</div>'
    }
    $('#detail').style.display = 'block'
    $('#detailTitle').textContent = e.type + (e.outcome ? ' — ' + e.outcome : '')
    const subParts = [e.players, PERIOD_LABELS[e.period] || '', e.matchTime, e.team]
    if (showMatchFilter && e.matchName) subParts.unshift(e.matchName)
    $('#detailSub').textContent = subParts.filter(Boolean).join(' · ')
    $('#detailNotes').textContent = e.notes || ''
    const link = $('#detailLink')
    if (e.youtubeId) {
      link.href = `https://youtu.be/${e.youtubeId}?t=${Math.max(0, Math.floor(e.start))}s`
      link.style.display = 'inline'
    } else {
      link.style.display = 'none'
    }
  }

  function rerender() {
    const filtered = computeFiltered()
    const shots = filtered.filter((e) => e.isShot)

    // Cabecera de cifras
    const goals = shots.filter((e) => /gol/i.test(e.outcome || '')).length
    $('#headline').innerHTML = `
      <div class="figure"><span class="n">${filtered.length}</span><span class="l">jugadas (con este filtro)</span></div>
      <div class="figure"><span class="n">${shots.length}</span><span class="l">lanzamientos</span></div>
      <div class="figure"><span class="n">${goals}</span><span class="l">goles</span></div>
      <div class="figure"><span class="n">${shots.length ? Math.round((goals / shots.length) * 100) : 0}%</span><span class="l">eficacia</span></div>`

    // Chips (sobre el dataset completo, para que no desaparezcan al filtrar)
    renderChipGroup($('#f-types'), 'Tipo', uniqueSorted(events, (e) => e.type), filters.types, (v) => { filters.types = toggleInArray(filters.types, v); rerender() })
    renderChipGroup($('#f-outcomes'), 'Resultado', uniqueSorted(events, (e) => e.outcome || 'Sin resultado'), filters.outcomes, (v) => { filters.outcomes = toggleInArray(filters.outcomes, v); rerender() })
    const periodOptions = Object.entries(PERIOD_LABELS)
      .filter(([code]) => events.some((e) => e.period === code))
      .map(([code, label]) => ({ value: label, count: events.filter((e) => e.period === code).length, code }))
    renderChipGroup($('#f-periods'), 'Parte', periodOptions, filters.periods.map((p) => PERIOD_LABELS[p] || p), (label) => {
      const code = periodOptions.find((o) => o.value === label)?.code
      if (code) { filters.periods = toggleInArray(filters.periods, code); rerender() }
    })
    renderChipGroup($('#f-teams'), 'Equipo', uniqueSorted(events, (e) => e.team), filters.teams, (v) => { filters.teams = toggleInArray(filters.teams, v); rerender() })
    renderChipGroup($('#f-players'), 'Jugador', uniqueSortedFlat(events, (e) => e.playersList), filters.players, (v) => { filters.players = toggleInArray(filters.players, v); rerender() })
    if (showMatchFilter) {
      renderChipGroup($('#f-matches'), 'Partido', uniqueSorted(events, (e) => e.matchName), filters.matches, (v) => { filters.matches = toggleInArray(filters.matches, v); rerender() })
    }

    // Estadísticas de lanzamiento
    renderBarList($('#barOutcome'),
      uniqueSorted(shots, (e) => e.outcome || 'Sin resultado'),
      filters.outcomes, (v) => { filters.outcomes = toggleInArray(filters.outcomes, v); rerender() },
      'Sin lanzamientos con este filtro')
    renderBarList($('#barPlayer'),
      uniqueSortedFlat(shots, (e) => e.playersList, 'Sin jugador'),
      filters.players, (v) => { filters.players = toggleInArray(filters.players, v); rerender() },
      'Sin lanzamientos con este filtro')

    const zoneCounts = {}
    for (const e of shots) if (e.zone) zoneCounts[e.zone] = (zoneCounts[e.zone] || 0) + 1
    renderShotZoneMap($('#zoneMap'), {
      counts: zoneCounts, selected: filters.zones,
      onToggle: (code) => { filters.zones = toggleInArray(filters.zones, code); rerender() }
    })

    const goalCounts = {}
    for (const e of shots) if (e.goalZone) goalCounts[e.goalZone] = (goalCounts[e.goalZone] || 0) + 1
    renderGoalZoneMap($('#goalMap'), {
      counts: goalCounts, selected: filters.goalZones,
      onToggle: (code) => { filters.goalZones = toggleInArray(filters.goalZones, code); rerender() }
    })

    // Lista de cortes (todos los tipos que pasan el filtro, no solo lanzamientos)
    $('#clipCount').textContent = `${filtered.length} corte${filtered.length === 1 ? '' : 's'}`
    $('#clipList').innerHTML = filtered.map(renderClipRow).join('') || '<div class="bar-empty" style="padding:14px">Sin cortes con este filtro</div>'
    $('#clipList').querySelectorAll('.clip-row').forEach((row) => {
      row.addEventListener('click', () => {
        const e = filtered.find((ev) => ev.id === row.dataset.id)
        if (e) { selectClip(e); rerender() }
      })
    })
  }

  $('#f-text').addEventListener('input', (e) => { filters.text = e.target.value; rerender() })
  $('#f-clear').addEventListener('click', () => {
    Object.assign(filters, { text: '', types: [], outcomes: [], periods: [], teams: [], players: [], zones: [], goalZones: [], matches: [] })
    $('#f-text').value = ''
    rerender()
  })

  rerender()
}

export { SHOT_ZONES, GOAL_LABELS }

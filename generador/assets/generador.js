// ─── Generador de páginas de estadísticas (a partir de uno o varios CSV) ──────
// Herramienta 100% local: los CSV se procesan aquí mismo, en el navegador, y
// se descarga un único .html listo para subir a este mismo repositorio
// (junto a index.html, para que pueda usar assets/app.css y assets/zones.js).

// ─── Definición de cada modo ──────────────────────────────────────────────────
const MODES = {
  jugadores: {
    title: 'Estadísticas de jugadores',
    subtitle: 'Lanzamientos de los jugadores del equipo analizado',
    defaultFileName: 'jugadores.html'
  },
  portero: {
    title: 'Estadísticas de portero',
    subtitle: 'Lanzamientos de jugadores rivales contra el portero analizado',
    defaultFileName: 'portero.html'
  }
}

// Nombres de columna "fijos" tal cual los exporta VideoCuts por defecto —
// todo lo demás (Mano, Fase de juego, Tipo de lanzamiento, Con amago,
// Postura...) se trata de forma genérica según la plantilla de cada uno.
const COL = {
  team: 'Equipo',
  code: 'Codigo',
  player: 'Jugador',
  outcome: 'Resultado',
  period: 'Parte',
  matchTime: 'Tiempo de partido',
  position: 'Posición',
  goal: 'Portería',
  clipId: 'ID del corte (técnico)',
  matchId: 'ID del partido (técnico)'
}

// ─── Parseo de CSV (mismo convenio que la exportación de VideoCuts: ────────────
// separador ";", BOM UTF-8, celdas entre comillas dobles si contienen ";", '"'
// o saltos de línea, con "" para escapar una comilla literal) ─────────────────
function parseCsv(text) {
  const clean = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++ } else { inQuotes = false }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ';') {
      row.push(field); field = ''
    } else if (c === '\n') {
      row.push(field); field = ''
      rows.push(row); row = []
    } else {
      field += c
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row) }

  const nonEmpty = rows.filter((r) => !(r.length === 1 && r[0] === ''))
  if (nonEmpty.length === 0) return { headers: [], records: [] }
  const headers = nonEmpty[0]
  const records = nonEmpty.slice(1).map((r) => {
    const obj = {}
    headers.forEach((h, i) => { obj[h] = r[i] ?? '' })
    return obj
  })
  return { headers, records }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function embedJson(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

// ─── Plantilla de la página generada (dashboard real, con filtros/gráficos) ───
function buildDashboardHtml({ mode, headers, records, sourceFileName }) {
  const cfg = MODES[mode]
  const generatedAt = new Date().toLocaleString()
  const payload = { mode, headers, records, sourceFileName, generatedAt }

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(cfg.title)} — VideoCuts</title>
<link rel="stylesheet" href="assets/app.css" />
<style>
  .team-grid .match-card { cursor: pointer; border: none; text-align: left; font-family: inherit; width: 100%; }
  .change-team-btn { background: transparent; border: 1px solid #333; color: #999; border-radius: 6px; padding: 5px 12px; font-size: 12px; cursor: pointer; }
  .change-team-btn:hover { border-color: #666; color: #ccc; }
  table.data-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  table.data-table th, table.data-table td { padding: 6px 10px; border-bottom: 1px solid #262626; text-align: left; white-space: nowrap; }
  table.data-table th { color: #888; font-weight: 600; position: sticky; top: 0; background: #1a1a1a; }
  table.data-table tr:hover td { background: #1e1e1e; }
  .table-wrap { overflow: auto; max-height: 480px; border: 1px solid #2a2a2a; border-radius: 8px; }
  .row-count { color: #666; font-size: 11px; margin-top: 8px; }
</style>
</head>
<body>
  <header class="site-header">
    <a class="back" href="index.html">← Partidos</a>
    <h1>${escapeHtml(cfg.title)}</h1>
    <span class="meta" id="teamMeta">${escapeHtml(cfg.subtitle)}</span>
    <span class="spacer"></span>
    <button class="change-team-btn" id="changeTeamBtn" hidden>↺ Cambiar de equipo</button>
  </header>

  <div class="home-wrap" id="teamGate">
    <p class="intro">Elige el equipo para ver sus estadísticas — el resto de filtros y gráficos se calculan solo sobre ese equipo.</p>
    <div class="match-grid team-grid" id="teamGrid"></div>
  </div>

  <div id="dashboardRoot" hidden></div>

<script id="data" type="application/json">${embedJson(payload)}</script>
<script type="module">
  import { renderShotZoneMap, renderGoalZoneMap, GOAL_LABELS } from './assets/zones.js'

  const DATA = JSON.parse(document.getElementById('data').textContent);
  const COL = ${JSON.stringify(COL)};
  const CORE_KEYS = new Set(Object.values(COL));
  // Columnas propias de cada plantilla (Mano, Fase de juego, Tipo de
  // lanzamiento, Con amago, Postura...) — se tratan de forma genérica.
  const EXTRA_FIELDS = DATA.headers.filter((h) => !CORE_KEYS.has(h));
  const MAX_DISTINCT_FOR_CHIPS = 20;

  const LABEL_TO_GOALZONE = Object.fromEntries(Object.entries(GOAL_LABELS).map(([code, label]) => [label, code]));
  function parseZoneCode(pos) {
    const m = (pos || '').match(/^\\s*(\\S+)\\s*·/);
    return m ? m[1] : null;
  }
  function parseGoalZoneCode(label) {
    return LABEL_TO_GOALZONE[label] || null;
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function toggleInArray(arr, val) {
    return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
  }
  function uniqueSorted(records, pick) {
    const map = new Map();
    for (const r of records) {
      const v = pick(r);
      if (!v) continue;
      map.set(v, (map.get(v) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));
  }

  const state = { team: null, filters: { text: '', byField: {} } };

  function teamsList() {
    return uniqueSorted(DATA.records, (r) => r[COL.team]);
  }

  function showTeamGate() {
    const teams = teamsList();
    document.getElementById('teamGrid').innerHTML = teams.map(({ value, count }) => \`
      <button class="match-card" data-team="\${escapeHtml(value)}">
        <div class="name">\${escapeHtml(value)}</div>
        <div class="figures"><span><b>\${count}</b> filas</span></div>
      </button>\`).join('') || '<div class="empty-state">No hay datos.</div>';
    document.querySelectorAll('.team-grid .match-card').forEach((btn) => {
      btn.addEventListener('click', () => selectTeam(btn.dataset.team));
    });
    document.getElementById('teamGate').hidden = false;
    document.getElementById('dashboardRoot').hidden = true;
    document.getElementById('changeTeamBtn').hidden = true;
  }

  function selectTeam(team) {
    state.team = team;
    state.filters = { text: '', byField: {} };
    document.getElementById('teamGate').hidden = true;
    document.getElementById('changeTeamBtn').hidden = false;
    document.getElementById('teamMeta').textContent = team;
    mountDashboard();
  }

  document.getElementById('changeTeamBtn').addEventListener('click', showTeamGate);

  function recordsForTeam() {
    return DATA.records.filter((r) => r[COL.team] === state.team);
  }

  function computeFiltered() {
    const base = recordsForTeam();
    const q = state.filters.text.trim().toLowerCase();
    return base.filter((r) => {
      if (q) {
        const hay = DATA.headers.map((h) => r[h] || '').join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      for (const field of Object.keys(state.filters.byField)) {
        const sel = state.filters.byField[field];
        if (sel.length > 0 && !sel.includes(r[field])) return false;
      }
      return true;
    });
  }

  function mountDashboard() {
    const root = document.getElementById('dashboardRoot');
    root.hidden = false;
    root.innerHTML = \`
      <div class="app-layout">
        <div class="app-main">
          <div class="panel filters">
            <div class="search-row">
              <input id="f-text" type="text" placeholder="Buscar en cualquier columna..." />
              <button class="clear-btn" id="f-clear">Limpiar filtros</button>
            </div>
            <div id="chip-groups"></div>
          </div>

          <div class="panel stat-headline" id="headline"></div>

          <div class="stats-grid">
            <div class="panel"><div class="panel-title">Por resultado</div><div id="barOutcome"></div></div>
            <div class="panel"><div class="panel-title">Por jugador</div><div id="barPlayer"></div></div>
            <div class="panel"><div class="panel-title">Zona de lanzamiento</div><div id="zoneMap"></div></div>
            <div class="panel"><div class="panel-title">Zona de portería</div><div id="goalMap"></div></div>
          </div>

          <div class="panel">
            <div class="panel-title">Detalle</div>
            <div class="table-wrap"><table class="data-table" id="dataTable"></table></div>
            <div class="row-count" id="rowCount"></div>
          </div>
        </div>
      </div>\`;

    document.getElementById('f-text').addEventListener('input', (e) => { state.filters.text = e.target.value; rerender(); });
    document.getElementById('f-clear').addEventListener('click', () => {
      state.filters = { text: '', byField: {} };
      document.getElementById('f-text').value = '';
      rerender();
    });

    rerender();
  }

  function renderChipGroup(el, groupLabel, options, selected, onToggle) {
    el.innerHTML = '<span class="group-label">' + escapeHtml(groupLabel) + '</span>' + options.map(({ value, count }) =>
      '<button type="button" class="chip ' + (selected.includes(value) ? 'active' : '') + '" data-v="' + escapeHtml(value) + '">' +
        escapeHtml(value) + ' <span style="opacity:.55">(' + count + ')</span></button>'
    ).join('');
    el.querySelectorAll('.chip').forEach((btn) => btn.addEventListener('click', () => onToggle(btn.dataset.v)));
    el.style.display = options.length ? 'flex' : 'none';
  }

  function renderBarList(el, data, selected, onToggle, emptyLabel) {
    if (data.length === 0) { el.innerHTML = '<div class="bar-empty">' + emptyLabel + '</div>'; return; }
    const max = Math.max(1, ...data.map((d) => d.count));
    el.innerHTML = data.map(({ value, count }) =>
      '<div class="bar-row ' + (selected.includes(value) ? 'active' : '') + '" data-v="' + escapeHtml(value) + '">' +
        '<span class="label">' + escapeHtml(value) + '</span>' +
        '<div class="track"><div class="fill" style="width:' + (count / max) * 100 + '%"></div></div>' +
        '<span class="n">' + count + '</span></div>'
    ).join('');
    el.querySelectorAll('.bar-row').forEach((row) => row.addEventListener('click', () => onToggle(row.dataset.v)));
  }

  function toggleField(field, value) {
    state.filters.byField[field] = toggleInArray(state.filters.byField[field] || [], value);
    rerender();
  }

  function rerender() {
    const $ = (sel) => document.getElementById(sel);
    const base = recordsForTeam();
    const filtered = computeFiltered();

    const goals = filtered.filter((r) => /gol/i.test(r[COL.outcome] || '')).length;
    $('headline').innerHTML =
      '<div class="figure"><span class="n">' + filtered.length + '</span><span class="l">lanzamientos (con este filtro)</span></div>' +
      '<div class="figure"><span class="n">' + goals + '</span><span class="l">goles</span></div>' +
      '<div class="figure"><span class="n">' + (filtered.length ? Math.round((goals / filtered.length) * 100) : 0) + '%</span><span class="l">eficacia</span></div>';

    // Chips: código de partido/jornada, parte, y cualquier campo propio de la
    // plantilla con pocos valores distintos (sobre el equipo entero, para que
    // no desaparezcan al filtrar).
    const chipFields = [COL.code, COL.period, ...EXTRA_FIELDS].filter((f) => {
      const n = uniqueSorted(base, (r) => r[f]).length;
      return n > 1 && n <= MAX_DISTINCT_FOR_CHIPS;
    });
    $('chip-groups').innerHTML = chipFields.map((f) => '<div class="chip-group" id="chips-' + btoa(encodeURIComponent(f)).replace(/=/g, '') + '"></div>').join('');
    for (const f of chipFields) {
      const el = document.getElementById('chips-' + btoa(encodeURIComponent(f)).replace(/=/g, ''));
      renderChipGroup(el, f, uniqueSorted(base, (r) => r[f]), state.filters.byField[f] || [], (v) => toggleField(f, v));
    }

    renderBarList($('barOutcome'), uniqueSorted(filtered, (r) => r[COL.outcome] || 'Sin resultado'),
      state.filters.byField[COL.outcome] || [], (v) => toggleField(COL.outcome, v), 'Sin lanzamientos con este filtro');
    renderBarList($('barPlayer'), uniqueSorted(filtered, (r) => r[COL.player]),
      state.filters.byField[COL.player] || [], (v) => toggleField(COL.player, v), 'Sin lanzamientos con este filtro');

    const zoneCounts = {};
    for (const r of filtered) { const z = parseZoneCode(r[COL.position]); if (z) zoneCounts[z] = (zoneCounts[z] || 0) + 1; }
    renderShotZoneMap($('zoneMap'), {
      counts: zoneCounts, selected: [],
      onToggle: () => {} // filtrar por zona exacta no aplica aquí: el texto ya es "código · nombre" completo
    });

    const goalCounts = {};
    for (const r of filtered) { const g = parseGoalZoneCode(r[COL.goal]); if (g) goalCounts[g] = (goalCounts[g] || 0) + 1; }
    renderGoalZoneMap($('goalMap'), { counts: goalCounts, selected: [], onToggle: () => {} });

    const tableCols = DATA.headers.filter((h) => h !== COL.clipId && h !== COL.matchId && h !== COL.team);
    const theadCells = tableCols.map((h) => '<th>' + escapeHtml(h) + '</th>').join('') + '<th>Vídeo</th>';
    const bodyRows = filtered.map((r) => {
      const cells = tableCols.map((h) => '<td>' + escapeHtml(r[h]) + '</td>').join('');
      const link = (r[COL.matchId] && r[COL.clipId])
        ? '<a href="corte.html?id=' + encodeURIComponent(r[COL.matchId]) + '&evento=' + encodeURIComponent(r[COL.clipId]) + '" target="_blank" rel="noopener">▶ ver</a>'
        : '—';
      return '<tr>' + cells + '<td>' + link + '</td></tr>';
    }).join('');
    $('dataTable').innerHTML = '<thead><tr>' + theadCells + '</tr></thead><tbody>' + bodyRows + '</tbody>';
    $('rowCount').textContent = filtered.length + ' de ' + base.length + ' filas de este equipo';
  }

  showTeamGate();
</script>
</body>
</html>`
}

function downloadFile(filename, content) {
  const blob = new Blob([content], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ─── UI del generador ─────────────────────────────────────────────────────────
const state = { mode: 'jugadores', headers: [], records: [] }

const fileInfoEl = document.getElementById('fileInfo')
const generateBtn = document.getElementById('generateBtn')
const statusEl = document.getElementById('status')

document.querySelectorAll('input[name="mode"]').forEach((el) => {
  el.addEventListener('change', () => { state.mode = el.value })
})

document.getElementById('csvInput').addEventListener('change', async (e) => {
  const files = [...e.target.files]
  if (files.length === 0) return
  let headers = []
  let records = []
  const names = []
  for (const file of files) {
    const text = await file.text()
    const parsed = parseCsv(text)
    if (headers.length === 0) headers = parsed.headers
    records = records.concat(parsed.records)
    names.push(file.name)
  }
  state.headers = headers
  state.records = records
  state.sourceFileName = names.join(', ')
  fileInfoEl.textContent = `✓ ${names.join(' + ')} — ${records.length} filas en total, ${headers.length} columnas`
  generateBtn.disabled = records.length === 0
})

generateBtn.addEventListener('click', () => {
  if (state.records.length === 0) return
  const html = buildDashboardHtml({
    mode: state.mode,
    headers: state.headers,
    records: state.records,
    sourceFileName: state.sourceFileName
  })
  downloadFile(MODES[state.mode].defaultFileName, html)
  statusEl.textContent = `✓ Descargado "${MODES[state.mode].defaultFileName}" — súbelo a este repositorio para publicarlo.`
})

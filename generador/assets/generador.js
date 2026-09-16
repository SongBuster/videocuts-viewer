// ─── Generador de páginas de estadísticas (a partir de un CSV) ────────────────
// Herramienta 100% local: se abre el CSV con el selector de fichero del propio
// navegador (File API), se procesa aquí mismo y se descarga un único .html
// autocontenido (datos + página, sin depender de ningún servidor ni de otros
// ficheros) listo para subir a este mismo repositorio.
//
// FASE ACTUAL: solo el esqueleto. La página generada carga y muestra los
// datos del CSV (tabla filtrable, para comprobar que la importación es
// correcta) pero los paneles de estadísticas/gráficos son de momento
// marcadores de posición — se rellenarán en una fase posterior.

// ─── Definición de cada modo ──────────────────────────────────────────────────
const MODES = {
  jugadores: {
    title: 'Estadísticas de jugadores',
    subtitle: 'Lanzamientos de los jugadores del equipo analizado',
    defaultFileName: 'jugadores.html',
    panels: [
      'Lanzamientos por resultado',
      'Lanzamientos por jugador',
      'Zona de lanzamiento',
      'Zona de portería',
      'Evolución por partido'
    ]
  },
  portero: {
    title: 'Estadísticas de portero',
    subtitle: 'Lanzamientos de jugadores rivales contra el portero analizado',
    defaultFileName: 'portero.html',
    panels: [
      'Lanzamientos recibidos por resultado',
      'Lanzamientos por equipo rival',
      'Zona de lanzamiento del rival',
      'Zona de portería recibida',
      'Evolución por partido'
    ]
  }
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

// ─── Plantilla de la página generada (esqueleto, sin cálculos estadísticos) ───
function buildSkeletonHtml({ mode, headers, records, sourceFileName }) {
  const cfg = MODES[mode]
  const generatedAt = new Date().toLocaleString()

  const panelsHtml = cfg.panels.map((p) => `
        <div class="panel placeholder-panel">
          <div class="panel-title">${escapeHtml(p)}</div>
          <div class="placeholder-body">📊 Pendiente de implementar</div>
        </div>`).join('')

  const payload = { mode, headers, records, sourceFileName, generatedAt }

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(cfg.title)} — VideoCuts</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: #121212; color: #e0e0e0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  a { color: #3b82f6; }
  header.site-header {
    padding: 14px 20px; border-bottom: 1px solid #2a2a2a;
    display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap;
  }
  header.site-header h1 { font-size: 17px; margin: 0; color: #fff; }
  header.site-header .meta { color: #666; font-size: 12px; }
  header.site-header a.back { color: #888; font-size: 12px; text-decoration: none; }
  header.site-header a.back:hover { color: #ccc; }
  .import-status { color: #4ade80; font-size: 12px; padding: 10px 20px; border-bottom: 1px solid #2a2a2a; }
  .wrap { max-width: 1100px; margin: 0 auto; padding: 20px; display: flex; flex-direction: column; gap: 18px; }
  .panel { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 10px; padding: 16px 18px; }
  .panel-title { color: #aaa; font-size: 12px; font-weight: 600; margin-bottom: 12px; text-transform: uppercase; letter-spacing: .03em; }
  .placeholder-panel { border-style: dashed; }
  .placeholder-body { color: #555; font-size: 13px; text-align: center; padding: 30px 10px; }
  .panels-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }
  .filters { display: flex; flex-direction: column; gap: 10px; }
  .filters .search-row { display: flex; gap: 10px; align-items: center; }
  .filters .search-row input {
    flex: 1; background: #1a1a1a; border: 1px solid #333; border-radius: 6px;
    color: #e0e0e0; padding: 7px 10px; font-size: 13px; outline: none;
  }
  .filters .clear-btn { background: transparent; border: 1px solid #333; color: #999; border-radius: 6px; padding: 7px 12px; font-size: 12px; cursor: pointer; }
  .filters .clear-btn:hover { border-color: #666; color: #ccc; }
  .chip-group { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip-group .group-label { color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; width: 100%; margin-top: 2px; }
  .chip { background: #1e1e1e; border: 1px solid #333; color: #ccc; border-radius: 999px; padding: 4px 12px; font-size: 12px; cursor: pointer; white-space: nowrap; }
  .chip:hover { border-color: #555; }
  .chip.active { background: #1e3a8a55; border-color: #3b82f6; color: #cfe0ff; }
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
    <span class="meta">${escapeHtml(cfg.subtitle)}</span>
  </header>
  <div class="import-status" id="importStatus"></div>

  <div class="wrap">
    <div class="panel filters">
      <div class="search-row">
        <input id="f-text" type="text" placeholder="Buscar en cualquier columna..." />
        <button class="clear-btn" id="f-clear">Limpiar filtros</button>
      </div>
      <div id="chip-groups"></div>
    </div>

    <div class="panels-grid">${panelsHtml}
    </div>

    <div class="panel">
      <div class="panel-title">Detalle (datos importados del CSV)</div>
      <div class="table-wrap"><table class="data-table" id="dataTable"></table></div>
      <div class="row-count" id="rowCount"></div>
    </div>
  </div>

<script id="data" type="application/json">${embedJson(payload)}</script>
<script>
  const DATA = JSON.parse(document.getElementById('data').textContent);
  document.getElementById('importStatus').textContent =
    '✓ ' + DATA.records.length + ' filas importadas de "' + DATA.sourceFileName + '" · generado ' + DATA.generatedAt;

  // Columnas candidatas a filtro rápido: pocos valores distintos (evita
  // columnas de texto libre o casi-únicas, como notas o el propio jugador
  // cuando hay muchos).
  const MAX_DISTINCT_FOR_CHIPS = 20;
  function distinctValues(field) {
    const set = new Set();
    for (const r of DATA.records) if (r[field]) set.add(r[field]);
    return [...set].sort();
  }
  const chipFields = DATA.headers.filter((h) => {
    const n = distinctValues(h).length;
    return n > 1 && n <= MAX_DISTINCT_FOR_CHIPS;
  });

  const filters = { text: '', byField: {} };

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function toggleInArray(arr, val) {
    return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
  }

  function computeFiltered() {
    const q = filters.text.trim().toLowerCase();
    return DATA.records.filter((r) => {
      if (q) {
        const hay = DATA.headers.map((h) => r[h] ?? '').join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      for (const field of Object.keys(filters.byField)) {
        const selected = filters.byField[field];
        if (selected.length > 0 && !selected.includes(r[field])) return false;
      }
      return true;
    });
  }

  function renderChips() {
    const el = document.getElementById('chip-groups');
    el.innerHTML = chipFields.map(function (field) {
      var options = distinctValues(field).map(function (v) {
        var selected = (filters.byField[field] || []).includes(v);
        return '<button type="button" class="chip ' + (selected ? 'active' : '') +
          '" data-field="' + escapeHtml(field) + '" data-v="' + escapeHtml(v) + '">' + escapeHtml(v) + '</button>';
      }).join('');
      return '<div class="chip-group"><span class="group-label">' + escapeHtml(field) + '</span>' + options + '</div>';
    }).join('');
    el.querySelectorAll('.chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const field = btn.dataset.field, v = btn.dataset.v;
        filters.byField[field] = toggleInArray(filters.byField[field] || [], v);
        rerender();
      });
    });
  }

  function renderTable(records) {
    const table = document.getElementById('dataTable');
    const theadCells = DATA.headers.map((h) => '<th>' + escapeHtml(h) + '</th>').join('');
    const bodyRows = records.map((r) =>
      '<tr>' + DATA.headers.map((h) => '<td>' + escapeHtml(r[h]) + '</td>').join('') + '</tr>'
    ).join('');
    table.innerHTML = '<thead><tr>' + theadCells + '</tr></thead><tbody>' + bodyRows + '</tbody>';
    document.getElementById('rowCount').textContent = records.length + ' de ' + DATA.records.length + ' filas';
  }

  function rerender() {
    renderChips();
    renderTable(computeFiltered());
  }

  document.getElementById('f-text').addEventListener('input', (e) => { filters.text = e.target.value; rerender(); });
  document.getElementById('f-clear').addEventListener('click', () => {
    filters.text = ''; filters.byField = {};
    document.getElementById('f-text').value = '';
    rerender();
  });

  rerender();
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
const state = { mode: 'jugadores', file: null, headers: [], records: [] }

const fileInfoEl = document.getElementById('fileInfo')
const generateBtn = document.getElementById('generateBtn')
const statusEl = document.getElementById('status')

document.querySelectorAll('input[name="mode"]').forEach((el) => {
  el.addEventListener('change', () => { state.mode = el.value })
})

document.getElementById('csvInput').addEventListener('change', async (e) => {
  const file = e.target.files[0]
  if (!file) return
  state.file = file
  const text = await file.text()
  const { headers, records } = parseCsv(text)
  state.headers = headers
  state.records = records
  fileInfoEl.textContent = `✓ ${file.name} — ${records.length} filas, ${headers.length} columnas`
  generateBtn.disabled = records.length === 0
})

generateBtn.addEventListener('click', () => {
  if (!state.file || state.records.length === 0) return
  const html = buildSkeletonHtml({
    mode: state.mode,
    headers: state.headers,
    records: state.records,
    sourceFileName: state.file.name
  })
  downloadFile(MODES[state.mode].defaultFileName, html)
  statusEl.textContent = `✓ Descargado "${MODES[state.mode].defaultFileName}" — súbelo a este repositorio para publicarlo.`
})

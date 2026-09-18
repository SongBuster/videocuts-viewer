// ─── Filtro desplegable multi-selección (estilo Looker Studio) ────────────────
// Desplegable con buscador, checkbox por elemento, "Seleccionar todos" y, al
// pasar el ratón por un elemento, un botón "SOLO" para dejarlo como única
// selección. Selección vacía = sin filtro (se entiende como "todos").
//
// Uso:
//   const filter = createDropdownFilter({
//     fieldLabel: 'Jugador',
//     options: [{ value: 'a', label: '#44 Fulano' }, ...],
//     onChange: (selected) => { ... } // selected: string[] (vacío = todos)
//   })
//   container.appendChild(filter.el)

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

export function createDropdownFilter({ fieldLabel, options, onChange, showSearch = true }) {
  let selected = [] // vacío = todos
  let searchText = ''

  const root = document.createElement('div')
  root.className = 'dd-filter'
  root.innerHTML = `
    <button type="button" class="dd-filter-btn">${escapeHtml(fieldLabel)}</button>
    <div class="dd-filter-panel" hidden>
      ${showSearch ? '<input type="text" class="dd-filter-search" placeholder="Buscar..." />' : ''}
      <label class="dd-filter-row dd-filter-allrow">
        <input type="checkbox" class="dd-filter-allcheck" />
        <span>Seleccionar todos</span>
      </label>
      <div class="dd-filter-list"></div>
    </div>`

  const btn = root.querySelector('.dd-filter-btn')
  const panel = root.querySelector('.dd-filter-panel')
  const searchInput = root.querySelector('.dd-filter-search')
  const allCheck = root.querySelector('.dd-filter-allcheck')
  const listEl = root.querySelector('.dd-filter-list')

  const isAllSelected = () => selected.length === 0

  function updateButtonState() {
    btn.classList.toggle('active', !isAllSelected())
  }

  function renderList() {
    const q = searchText.trim().toLowerCase()
    const visible = options.filter((o) => o.label.toLowerCase().includes(q))

    listEl.innerHTML = visible.map((o) => `
      <label class="dd-filter-row" data-value="${escapeHtml(o.value)}">
        <input type="checkbox" ${isAllSelected() || selected.includes(o.value) ? 'checked' : ''} />
        <span class="dd-filter-row-label">${escapeHtml(o.label)}</span>
        <button type="button" class="dd-filter-only">SOLO</button>
      </label>`).join('') || '<div class="dd-filter-empty">Sin resultados</div>'

    allCheck.checked = isAllSelected()

    listEl.querySelectorAll('.dd-filter-row').forEach((row) => {
      const value = row.dataset.value
      const checkbox = row.querySelector('input[type=checkbox]')
      checkbox.addEventListener('change', () => {
        if (isAllSelected()) {
          // De "todos" a una selección explícita: todos menos el que se acaba de desmarcar.
          selected = options.map((o) => o.value).filter((v) => v !== value)
        } else if (checkbox.checked) {
          selected = [...selected, value]
          if (selected.length === options.length) selected = [] // vuelve a "todos"
        } else {
          selected = selected.filter((v) => v !== value)
        }
        renderList()
        updateButtonState()
        onChange(selected)
      })
      row.querySelector('.dd-filter-only').addEventListener('click', (e) => {
        e.preventDefault()
        selected = [value]
        renderList()
        updateButtonState()
        onChange(selected)
      })
    })
  }

  allCheck.addEventListener('change', () => {
    selected = []
    renderList()
    updateButtonState()
    onChange(selected)
  })

  if (searchInput) searchInput.addEventListener('input', (e) => { searchText = e.target.value; renderList() })

  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    const willOpen = panel.hidden
    document.querySelectorAll('.dd-filter-panel').forEach((p) => { p.hidden = true })
    panel.hidden = !willOpen
    if (willOpen && searchInput) searchInput.focus()
  })

  panel.addEventListener('click', (e) => e.stopPropagation())
  document.addEventListener('click', () => { panel.hidden = true })

  renderList()
  updateButtonState()

  return {
    el: root,
    getSelected: () => selected,
    // Permite fijar la selección desde fuera (p.ej. al pulsar un elemento en
    // un gráfico) manteniendo el desplegable sincronizado visualmente.
    setSelected: (newSelected) => {
      selected = newSelected
      renderList()
      updateButtonState()
    }
  }
}

// ─── Filtro desplegable en árbol (grupo > sub-elementos) ──────────────────────
// Igual que createDropdownFilter (selección vacía = todos, botón "SOLO" al
// pasar el ratón) pero de dos niveles: marcar un grupo entero marca todos sus
// hijos; si solo hay algunos hijos de un grupo marcados, su checkbox queda en
// estado "parcial". Sin buscador — pensado para árboles pequeños.
//
// Uso:
//   const filter = createTreeDropdownFilter({
//     fieldLabel: 'Tiempo de juego',
//     groups: [{ value: '1ª parte', label: '1ª parte', children: [{value:'1ª parte__0', label:'0-5 min'}, ...] }, ...],
//     onChange: (selectedLeafValues) => { ... }
//   })
export function createTreeDropdownFilter({ fieldLabel, groups, onChange }) {
  let selected = [] // vacío = todos; si no, lista de VALORES DE HOJA seleccionados
  const expanded = {} // group.value -> boolean; por defecto, todos expandidos
  for (const g of groups) expanded[g.value] = true

  const allLeafValues = groups.flatMap((g) => g.children.map((c) => c.value))

  const root = document.createElement('div')
  root.className = 'dd-filter'
  root.innerHTML = `
    <button type="button" class="dd-filter-btn">${escapeHtml(fieldLabel)}</button>
    <div class="dd-filter-panel" hidden>
      <label class="dd-filter-row dd-filter-allrow">
        <input type="checkbox" class="dd-filter-allcheck" />
        <span>Seleccionar todos</span>
      </label>
      <div class="dd-filter-list"></div>
    </div>`

  const btn = root.querySelector('.dd-filter-btn')
  const panel = root.querySelector('.dd-filter-panel')
  const allCheck = root.querySelector('.dd-filter-allcheck')
  const listEl = root.querySelector('.dd-filter-list')

  const isAllSelected = () => selected.length === 0

  function updateButtonState() {
    btn.classList.toggle('active', !isAllSelected())
  }

  function groupState(group) {
    if (isAllSelected()) return 'checked'
    const leaves = group.children.map((c) => c.value)
    const n = leaves.filter((v) => selected.includes(v)).length
    if (n === 0) return 'unchecked'
    if (n === leaves.length) return 'checked'
    return 'indeterminate'
  }

  function setGroup(group, checked) {
    const leaves = group.children.map((c) => c.value)
    const base = isAllSelected() ? allLeafValues : selected
    selected = checked
      ? [...new Set([...base, ...leaves])]
      : base.filter((v) => !leaves.includes(v))
    if (selected.length === allLeafValues.length) selected = []
  }

  function setLeaf(value, checked) {
    const base = isAllSelected() ? allLeafValues : selected
    selected = checked ? [...new Set([...base, value])] : base.filter((v) => v !== value)
    if (selected.length === allLeafValues.length) selected = []
  }

  function renderList() {
    listEl.innerHTML = groups.map((g) => {
      const state = groupState(g)
      const isOpen = expanded[g.value]
      const childrenHtml = isOpen ? g.children.map((c) => `
        <label class="dd-filter-row dd-filter-row-child" data-leaf="${escapeHtml(c.value)}">
          <input type="checkbox" ${isAllSelected() || selected.includes(c.value) ? 'checked' : ''} />
          <span class="dd-filter-row-label">${escapeHtml(c.label)}</span>
          <button type="button" class="dd-filter-only">SOLO</button>
        </label>`).join('') : ''
      return `
        <div class="dd-filter-row dd-filter-row-group" data-group="${escapeHtml(g.value)}">
          <button type="button" class="dd-filter-expand" data-group-toggle="${escapeHtml(g.value)}">${isOpen ? '▾' : '▸'}</button>
          <label class="dd-filter-row-grouplabel">
            <input type="checkbox" data-state="${state}" ${state === 'checked' ? 'checked' : ''} />
            <span class="dd-filter-row-label">${escapeHtml(g.label)}</span>
          </label>
          <button type="button" class="dd-filter-only">SOLO</button>
        </div>
        ${childrenHtml}`
    }).join('')

    allCheck.checked = isAllSelected()

    listEl.querySelectorAll('.dd-filter-row-group').forEach((row) => {
      const groupValue = row.dataset.group
      const group = groups.find((g) => g.value === groupValue)
      const checkbox = row.querySelector('input[type=checkbox]')
      checkbox.indeterminate = checkbox.dataset.state === 'indeterminate'
      checkbox.addEventListener('change', () => {
        setGroup(group, checkbox.checked)
        renderList()
        updateButtonState()
        onChange(selected)
      })
      row.querySelector('.dd-filter-only').addEventListener('click', (e) => {
        e.preventDefault()
        selected = group.children.map((c) => c.value)
        renderList()
        updateButtonState()
        onChange(selected)
      })
      row.querySelector('.dd-filter-expand').addEventListener('click', (e) => {
        e.preventDefault()
        expanded[groupValue] = !expanded[groupValue]
        renderList()
      })
    })

    listEl.querySelectorAll('.dd-filter-row-child').forEach((row) => {
      const value = row.dataset.leaf
      const checkbox = row.querySelector('input[type=checkbox]')
      checkbox.addEventListener('change', () => {
        setLeaf(value, checkbox.checked)
        renderList()
        updateButtonState()
        onChange(selected)
      })
      row.querySelector('.dd-filter-only').addEventListener('click', (e) => {
        e.preventDefault()
        selected = [value]
        renderList()
        updateButtonState()
        onChange(selected)
      })
    })
  }

  allCheck.addEventListener('change', () => {
    selected = []
    renderList()
    updateButtonState()
    onChange(selected)
  })

  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    const willOpen = panel.hidden
    document.querySelectorAll('.dd-filter-panel').forEach((p) => { p.hidden = true })
    panel.hidden = !willOpen
  })

  panel.addEventListener('click', (e) => e.stopPropagation())
  document.addEventListener('click', () => { panel.hidden = true })

  renderList()
  updateButtonState()

  return {
    el: root,
    getSelected: () => selected
  }
}

// ─── Árbol fijo de "Tiempo de juego": parte > tramos de 5 minutos (0-30) ──────
const TIME_PARTS = ['1ª parte', '2ª parte']
const TIME_BUCKET_STARTS = [0, 5, 10, 15, 20, 25]

export function buildTimeTree() {
  return TIME_PARTS.map((part) => ({
    value: part,
    label: part,
    children: TIME_BUCKET_STARTS.map((start) => ({
      value: `${part}__${start}`,
      label: `${start}-${start + 5} min`
    }))
  }))
}

// A qué hoja del árbol de tiempo pertenece un registro, según sus columnas
// "Parte" (texto tal cual "1ª parte"/"2ª parte") y "Tiempo de partido" (mm:ss).
// Los minutos >= 30 (tiempo añadido) caen en el último tramo, 25-30.
export function computeTimeBucketKey(record, { partCol = 'Parte', timeCol = 'Tiempo de partido' } = {}) {
  const part = record[partCol]
  const time = record[timeCol]
  if (!part || !time) return null
  const minute = parseInt(String(time).split(':')[0], 10)
  if (Number.isNaN(minute)) return null
  const start = Math.min(TIME_BUCKET_STARTS[TIME_BUCKET_STARTS.length - 1], Math.floor(minute / 5) * 5)
  return `${part}__${start}`
}

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

export function createDropdownFilter({ fieldLabel, options, onChange }) {
  let selected = [] // vacío = todos
  let searchText = ''

  const root = document.createElement('div')
  root.className = 'dd-filter'
  root.innerHTML = `
    <button type="button" class="dd-filter-btn">${escapeHtml(fieldLabel)}</button>
    <div class="dd-filter-panel" hidden>
      <input type="text" class="dd-filter-search" placeholder="Buscar..." />
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

  searchInput.addEventListener('input', (e) => { searchText = e.target.value; renderList() })

  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    const willOpen = panel.hidden
    document.querySelectorAll('.dd-filter-panel').forEach((p) => { p.hidden = true })
    panel.hidden = !willOpen
    if (willOpen) searchInput.focus()
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

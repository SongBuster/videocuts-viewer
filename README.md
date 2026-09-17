# videocuts-viewer

Web de estadísticas de VideoCuts, alojada con GitHub Pages. Organizada por
rival: se elige un equipo y todo lo demás se filtra sobre él.

## Estructura

- `index.html` — portada: lista de rivales de los que hay datos.
- `rival.html?equipo=...` — página de un rival, con pestañas Jugadores/Portero.
- `data/lanzamientos/index.json` — índice de todos los CSV publicados (equipo, jornada, tipo, nº de filas).
- `data/lanzamientos/<id>.json` — datos de un CSV concreto (un equipo + una jornada + un tipo).
- `generador/` — herramienta local para generar esos ficheros a partir de un CSV (ver más abajo).

> Ficheros de una etapa anterior del proyecto (`partido.html`, `estadisticas.html`,
> `corte.html`, `data/*.json` de partidos) se mantienen sin tocar por ahora, pero
> ya no forman parte del flujo principal — se retomarán más adelante.

## Cómo añadir un partido/jornada nuevo

1. En VideoCuts: Estadísticas → Configurar exportación CSV (con la columna
   **Equipo** incluida, además de las propias de la plantilla) → Generar CSV.
2. Abre `generador/index.html` (doble clic, sin instalar nada) — también
   disponible en `https://songbuster.github.io/videocuts-viewer/generador/`.
3. Elige el tipo (Jugadores/Portero), sube el CSV y pulsa "Generar datos".
   El generador consulta el índice ya publicado en la web para no duplicar
   nada si repites un equipo/jornada.
4. Se descargan 1-2 ficheros pequeños: `<id>.json` (los datos de ese
   equipo+jornada) e `index.json` (el índice actualizado). Súbelos a
   `data/lanzamientos/` en este repositorio y haz commit + push.
5. El rival ya aparece en la portada.

## Estado actual (deliberadamente mínimo, en construcción)

La pestaña **Jugadores** de `rival.html` solo muestra de momento cuántos
eventos hay cargados, a modo de prueba de que el proceso de datos funciona
— los filtros/gráficos/tabla se irán añadiendo. La pestaña **Portero** está
vacía a propósito: el CSV de portero de etapas anteriores no encaja con
este diseño y se redefinirá más adelante.

# videocuts-viewer

Web de estadísticas y cortes de partido de VideoCuts, alojada con GitHub Pages.

## Estructura

- `index.html` — listado de partidos publicados.
- `partido.html?id=...` — estadísticas y cortes (con vídeo de YouTube) de un partido.
- `corte.html?id=...&evento=...` — detalle de un único corte (vídeo grande + ficha), pensado para enlazar desde fuera (ej. desde `jugadores.html`/`portero.html`).
- `estadisticas.html` — vista combinada de todos los partidos publicados.
- `data/` — datos de cada partido (JSON), publicados desde VideoCuts (Estadísticas → Publicar en la web).
- `generador/` — herramienta local para generar `jugadores.html`/`portero.html` a partir de uno o varios CSV (ver más abajo).
- `jugadores.html` / `portero.html` — estadísticas de lanzamientos, generadas con `generador/` (no desde VideoCuts directamente).

## Estadísticas de jugadores y de portero (a partir de CSV)

Estas dos páginas son un caso aparte: no se publican desde el botón de VideoCuts,
sino a partir de **CSV exportados desde VideoCuts** (Estadísticas → Configurar
exportación CSV → Generar CSV) — uno para los lanzamientos del equipo analizado
("jugadores"), otro para los lanzamientos recibidos por el portero analizado
("portero"). La columna "Equipo" es la clave: cada CSV es de UN equipo analizado
en UNA jornada, y se van juntando todos en una sola página.

Proceso:

1. En VideoCuts, configura la exportación CSV incluyendo **Equipo**, **ID del
   corte** e **ID del partido** (además de las columnas propias de cada
   plantilla) → Generar CSV, uno por partido.
2. Abre `generador/index.html` (doble clic, sin instalar nada) — también
   disponible en `https://songbuster.github.io/videocuts-viewer/generador/`.
3. Elige el tipo (Jugadores/Portero), selecciona **todos** los CSV que tengas
   hasta ahora (de todos los equipos/jornadas — se pueden elegir varios a la
   vez) y pulsa "Generar página web".
4. Se descarga un único `.html` — súbelo a este repositorio (junto a
   `index.html`) como `jugadores.html` o `portero.html`, **sustituyendo al que
   hubiera antes**, y haz commit + push.

La página generada, al abrirse, pide primero **qué equipo analizar** — el
resto de filtros, gráficos y la tabla de detalle se calculan solo sobre ese
equipo. La tabla de detalle enlaza cada fila a `corte.html` con el vídeo de
ese corte exacto (usando las columnas técnicas de ID).

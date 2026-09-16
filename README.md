# videocuts-viewer

Web de estadísticas y cortes de partido de VideoCuts, alojada con GitHub Pages.

## Estructura

- `index.html` — listado de partidos publicados.
- `partido.html?id=...` — estadísticas y cortes (con vídeo de YouTube) de un partido.
- `estadisticas.html` — vista combinada de todos los partidos publicados.
- `data/` — datos de cada partido (JSON), publicados desde VideoCuts (Estadísticas → Publicar en la web).
- `generador/` — herramienta local para generar las páginas de estadísticas de jugadores/portero a partir de un CSV (ver más abajo).

## Estadísticas de jugadores y de portero (a partir de un CSV)

Estas dos páginas son un caso aparte: no se publican desde el botón de VideoCuts,
sino a partir de un **CSV exportado desde VideoCuts** (Estadísticas → Configurar
exportación CSV → Generar CSV) — uno para los lanzamientos del equipo analizado
("jugadores"), otro para los lanzamientos recibidos por el portero analizado
("portero").

Proceso:

1. En VideoCuts, genera el CSV correspondiente.
2. Abre `generador/index.html` (haciendo doble clic, sin instalar nada) — también
   disponible en `https://songbuster.github.io/videocuts-viewer/generador/`.
3. Elige el tipo (Jugadores/Portero), sube el CSV y pulsa "Generar página web".
4. Se descarga un `.html` autocontenido — súbelo a este repositorio (junto a
   `index.html`) como `jugadores.html` o `portero.html` y haz commit + push.

> **Estado actual: solo el esqueleto.** La página generada ya importa y muestra
> los datos del CSV (tabla filtrable, para comprobar que todo se lee bien), pero
> los paneles de estadísticas/gráficos son de momento marcadores de posición —
> se implementan en una fase posterior.

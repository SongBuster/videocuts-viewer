# videocuts-viewer

Web de estadísticas de VideoCuts, alojada con GitHub Pages (y también
desplegada en Vercel desde la misma rama `main`). Acceso por invitación:
cada publicador tiene sus propios canales en Supabase, y cada visor solo ve
los canales a los que se le ha invitado.

## Estructura

- `app/login.html` — entrada a la app: iniciar sesión o crear cuenta.
- `app/index.html` — equipos/canales a los que tiene acceso la cuenta.
- `app/canal.html?id=...&equipo=...` — estadísticas de un equipo, pestañas Jugadores/Portero.
- `app/admin.html` — panel del publicador: crear canales, invitar, revocar accesos, borrar canales.
- `app/invite.html?token=...` — canjear una invitación de un solo uso.
- `app/manifest.json` / `app/sw.js` — para poder "instalar" la app en iOS/Android.
- `assets/` — CSS/JS compartido por todas las páginas de `app/`.
- `assets/supabase.js` — cliente de Supabase (auth, canales, datasets, invitaciones).
- `index.html` (raíz) — redirección a `app/login.html`; no hay más contenido público en la raíz.

## Cómo se publican los datos

Se publican desde VideoCuts (Ajustes → Cuenta en la nube / Estadísticas →
Publicar en la nube), directamente contra Supabase — no hace falta tocar
este repositorio para publicar un partido nuevo. Este repo es solo el
frontend que los consulta.

## Esquema de la base de datos

Ver `supabase/` en el repositorio `videocuts` (la app de escritorio): ahí
vive el schema.sql y las migraciones que hay que aplicar en el proyecto de
Supabase.

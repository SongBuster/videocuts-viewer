// Cliente de Supabase para la web (sin build step: import ESM directo desde
// CDN, igual de válido que el paquete npm — este repo no tiene bundler).
// La URL y la clave "anon" son públicas por diseño de Supabase (la
// seguridad la da RLS, no ocultar la clave) — mismo proyecto que usa
// VideoCuts (src/shared/supabaseConfig.ts) para publicar.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = 'https://imugaujkywjqwdbyudba.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltdWdhdWpreXdqcXdkYnl1ZGJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNTczMDksImV4cCI6MjEwNTgzMzMwOX0.ahzv4abLiDQefmCEXcW4yL8AM8BtSoAE3k6zETenznQ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  return data.session
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw new Error(error.message)
  if (!data.session) {
    throw new Error('Cuenta creada — confirma tu correo (revisa la bandeja de entrada) antes de iniciar sesión.')
  }
  return data.session
}

export async function logout() {
  await supabase.auth.signOut()
}

// Redirige a login.html si no hay sesión — usar al principio de cualquier
// página que requiera estar autenticado. Guarda la URL actual para volver
// aquí tras iniciar sesión (usado por invite.html).
export async function requireSession() {
  const session = await getSession()
  if (!session) {
    const next = encodeURIComponent(location.pathname.split('/').pop() + location.search)
    location.href = `login.html?next=${next}`
    return null
  }
  return session
}

// Todos los equipos accesibles al usuario logueado, agrupados por canal —
// una tarjeta por (canal, equipo), como ya hacía la portada pública con
// (equipo) solo. Un canal puede tener más de un equipo (p.ej. un canal por
// competición con varios rivales dentro). matchCount cuenta partidos
// (códigos de jornada) distintos, no filas — jugadores y portero del mismo
// partido cuentan una sola vez.
export async function getAccessibleTeams() {
  const { data: channels, error: chErr } = await supabase.from('channels').select('id, name')
  if (chErr) throw new Error(chErr.message)
  if (!channels || channels.length === 0) return []

  const channelIds = channels.map((c) => c.id)
  const { data: rows, error: dsErr } = await supabase
    .from('datasets')
    .select('channel_id, team, code')
    .in('channel_id', channelIds)
  if (dsErr) throw new Error(dsErr.message)

  const channelById = Object.fromEntries(channels.map((c) => [c.id, c.name]))
  const byTeam = new Map()
  for (const row of rows ?? []) {
    const key = `${row.channel_id}::${row.team}`
    let entry = byTeam.get(key)
    if (!entry) {
      entry = { channelId: row.channel_id, channelName: channelById[row.channel_id] ?? '?', team: row.team, codes: new Set() }
      byTeam.set(key, entry)
    }
    entry.codes.add(row.code)
  }
  const teams = [...byTeam.values()].map((t) => ({
    channelId: t.channelId, channelName: t.channelName, team: t.team, matchCount: t.codes.size
  }))
  teams.sort((a, b) => a.team.localeCompare(b.team))
  return teams
}

// Todas las filas de un equipo dentro de un canal, para un modo dado
// (jugadores/portero) — puede haber varias jornadas (varios "code"), se
// agregan igual que antes hacía Promise.all + flatMap sobre varios ficheros.
// Cada fila lleva además "_datasetId" (el id de su partido/jornada, mismo
// id que la fila de "datasets") — no es una columna publicada, es solo para
// poder pedir luego las opciones de corrección de ESE partido en concreto
// (ver fetchFieldOptions): dos partidos del mismo canal pueden llevar
// plantillas distintas, así que sus opciones no tienen por qué coincidir.
export async function fetchTeamRecords(channelId, team, mode) {
  const { data, error } = await supabase
    .from('datasets')
    .select('id, records')
    .eq('channel_id', channelId)
    .eq('team', team)
    .eq('mode', mode)
  if (error) throw new Error(error.message)
  return (data ?? []).flatMap((d) => d.records.map((r) => ({ ...r, _datasetId: d.id })))
}

// ─── Corrección de jugadas desde el viewer ─────────────────────────────────
// Ver fix_003_event_corrections.sql / fix_004_field_options_per_dataset.sql
// en el repo "videocuts" (la app de escritorio) para el esquema completo.

// Opciones válidas por campo para UN partido (no para todo el canal — cada
// partido puede llevar una plantilla distinta). {} si todavía no se ha
// publicado nada desde una versión de VideoCuts que mande este catálogo.
export async function fetchFieldOptions(datasetId) {
  const { data, error } = await supabase
    .from('dataset_field_options')
    .select('field_options')
    .eq('dataset_id', datasetId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data?.field_options ?? {}
}

// Todas las correcciones ya guardadas para un canal+rol — se piden de golpe
// al cargar la pestaña (no una por jugada) y se superponen en memoria sobre
// los registros publicados, para que listados/filtros/estadísticas usen ya
// el valor corregido sin más cambios en el resto del código.
export async function fetchCorrections(channelId, role) {
  const { data, error } = await supabase
    .from('event_corrections')
    .select('event_id, field, old_value, new_value')
    .eq('channel_id', channelId)
    .eq('role', role)
  if (error) throw new Error(error.message)
  return data ?? []
}

// Guarda varias correcciones de una jugada de golpe (una fila por campo
// cambiado). Upsert por (channel_id, event_id, field): corregir el mismo
// campo dos veces actualiza la fila en vez de duplicarla.
export async function saveCorrections(channelId, eventId, role, changes) {
  const session = await getSession()
  if (!session) throw new Error('Inicia sesión para poder corregir una jugada.')
  if (changes.length === 0) return
  const rows = changes.map((c) => ({
    channel_id: channelId,
    event_id: eventId,
    role,
    field: c.field,
    old_value: c.oldValue ?? null,
    new_value: c.newValue,
    corrected_by: session.user.id
  }))
  const { error } = await supabase
    .from('event_corrections')
    .upsert(rows, { onConflict: 'channel_id,event_id,field' })
  if (error) throw new Error(error.message)
}

export async function getChannelName(channelId) {
  const { data, error } = await supabase.from('channels').select('name').eq('id', channelId).maybeSingle()
  if (error) throw new Error(error.message)
  return data?.name ?? null
}

export async function redeemInvite(token) {
  const { data, error } = await supabase.rpc('redeem_channel_invite', { p_token: token })
  if (error) throw new Error(error.message)
  return data // channel_id
}

// ─── Administración (app/admin.html) ───────────────────────────────────────
// Solo útil para quien ha iniciado sesión con la cuenta que posee los
// canales — RLS ya limita todo esto a "lo mío": un usuario sin canales
// propios simplemente ve listas vacías, no hace falta un rol aparte.

export async function getOwnedChannels() {
  const session = await getSession()
  if (!session) return []
  const { data, error } = await supabase
    .from('channels')
    .select('id, name, created_at')
    .eq('owner_id', session.user.id)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createChannel(name) {
  const session = await getSession()
  if (!session) throw new Error('Inicia sesión antes de crear un canal.')
  const { data, error } = await supabase
    .from('channels')
    .insert({ name, owner_id: session.user.id })
    .select('id, name, created_at')
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function createInvite(channelId) {
  const session = await getSession()
  if (!session) throw new Error('Inicia sesión antes de generar una invitación.')
  const { data, error } = await supabase
    .from('channel_invites')
    .insert({ channel_id: channelId, created_by: session.user.id })
    .select('token')
    .single()
  if (error) throw new Error(error.message)
  return data.token
}

export async function revokeInvite(token) {
  const { error } = await supabase.from('channel_invites').update({ revoked: true }).eq('token', token)
  if (error) throw new Error(error.message)
}

export async function listChannelInvites(channelId) {
  const { data, error } = await supabase.rpc('admin_list_channel_invites', { p_channel_id: channelId })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listChannelViewers(channelId) {
  const { data, error } = await supabase.rpc('admin_list_channel_viewers', { p_channel_id: channelId })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function revokeAccess(channelId, userId) {
  const { error } = await supabase
    .from('channel_access')
    .delete()
    .eq('channel_id', channelId)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
}

// Borra el canal entero — irreversible. RLS (channels_delete_own) exige
// que el que llama sea el dueño; sus datasets/accesos/invitaciones se
// borran solos en cascada (on delete cascade en schema.sql), no hace falta
// borrarlos aparte primero.
export async function deleteChannel(channelId) {
  const { error } = await supabase.from('channels').delete().eq('id', channelId)
  if (error) throw new Error(error.message)
}

// Datasets publicados en un canal (uno por equipo+jornada+modo — jugadores
// y portero del mismo partido son dos filas distintas, ver datasetRowId en
// supabaseService.ts). Ya cubierto por la política de RLS del dueño
// (datasets_write_own_channel es "for all", incluye select y delete), sin
// necesidad de una función aparte.
export async function listChannelDatasets(channelId) {
  const { data, error } = await supabase
    .from('datasets')
    .select('team, code, mode, records, generated_at')
    .eq('channel_id', channelId)
  if (error) throw new Error(error.message)
  return data ?? []
}

// Borra TODAS las filas (jugadores + portero) de un equipo+jornada concreto
// dentro de un canal — "una jornada suelta", no el canal entero.
export async function deleteJornada(channelId, team, code) {
  const { error } = await supabase
    .from('datasets')
    .delete()
    .eq('channel_id', channelId)
    .eq('team', team)
    .eq('code', code)
  if (error) throw new Error(error.message)
}

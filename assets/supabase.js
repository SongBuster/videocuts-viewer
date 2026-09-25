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
// competición con varios rivales dentro).
export async function getAccessibleTeams() {
  const { data: channels, error: chErr } = await supabase.from('channels').select('id, name')
  if (chErr) throw new Error(chErr.message)
  if (!channels || channels.length === 0) return []

  const channelIds = channels.map((c) => c.id)
  const { data: rows, error: dsErr } = await supabase
    .from('datasets')
    .select('channel_id, team')
    .in('channel_id', channelIds)
  if (dsErr) throw new Error(dsErr.message)

  const channelById = Object.fromEntries(channels.map((c) => [c.id, c.name]))
  const seen = new Set()
  const teams = []
  for (const row of rows ?? []) {
    const key = `${row.channel_id}::${row.team}`
    if (seen.has(key)) continue
    seen.add(key)
    teams.push({ channelId: row.channel_id, channelName: channelById[row.channel_id] ?? '?', team: row.team })
  }
  teams.sort((a, b) => a.team.localeCompare(b.team))
  return teams
}

// Todas las filas de un equipo dentro de un canal, para un modo dado
// (jugadores/portero) — puede haber varias jornadas (varios "code"), se
// agregan igual que antes hacía Promise.all + flatMap sobre varios ficheros.
export async function fetchTeamRecords(channelId, team, mode) {
  const { data, error } = await supabase
    .from('datasets')
    .select('records')
    .eq('channel_id', channelId)
    .eq('team', team)
    .eq('mode', mode)
  if (error) throw new Error(error.message)
  return (data ?? []).flatMap((d) => d.records)
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

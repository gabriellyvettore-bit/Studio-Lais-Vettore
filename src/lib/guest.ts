// A cliente não tem cadastro com senha: depois do primeiro agendamento o
// celular dela fica "lembrado" por um código aleatório guardado só neste
// aparelho (o banco guarda apenas o hash).
const KEY = 'slv:cliente'

export interface GuestSession {
  token: string
  first_name: string
  full_name?: string
  phone?: string
}

export function getGuest(): GuestSession | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null')
    return v && typeof v.token === 'string' && v.token.length === 64 ? v : null
  } catch { return null }
}

export function saveGuest(s: GuestSession) {
  localStorage.setItem(KEY, JSON.stringify(s))
}

export function clearGuest() {
  localStorage.removeItem(KEY)
}

/** "10/05/1990" -> "1990-05-10" (ou null se inválida) */
export function parseBirth(v: string): string | null {
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const [, d, mo, y] = m
  const date = new Date(`${y}-${mo}-${d}T12:00:00`)
  if (isNaN(+date) || date.getDate() !== Number(d) || date.getMonth() + 1 !== Number(mo)) return null
  if (Number(y) < 1900 || date > new Date()) return null
  return `${y}-${mo}-${d}`
}

export function maskBirth(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

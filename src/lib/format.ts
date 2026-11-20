import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { AppointmentStatus, HairLength, Service, ServicePrice } from './types'

export const TZ = 'America/Sao_Paulo'

export const HAIR_LENGTHS: { value: HairLength; label: string; hint: string }[] = [
  { value: 'curto', label: 'Curto', hint: 'Até a altura do queixo' },
  { value: 'medio', label: 'Médio', hint: 'Até os ombros' },
  { value: 'longo', label: 'Longo', hint: 'Abaixo dos ombros, até o meio das costas' },
  { value: 'extra_longo', label: 'Extra longo', hint: 'Abaixo do meio das costas' },
]

export const lengthLabel = (l: HairLength | null | undefined) =>
  l ? HAIR_LENGTHS.find((h) => h.value === l)?.label ?? l : ''

export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
export const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pendente: 'Aguardando aprovação',
  confirmado: 'Confirmado',
  recusado: 'Recusado',
  cancelado: 'Cancelado',
  concluido: 'Concluído',
  faltou: 'Não compareceu',
}

export const STATUS_STYLE: Record<AppointmentStatus, string> = {
  pendente: 'bg-areia text-espresso border-bronze/50',
  confirmado: 'bg-espresso text-marfim border-espresso',
  recusado: 'bg-transparent text-erro border-erro/40 line-through',
  cancelado: 'bg-transparent text-espresso/50 border-espresso/20 line-through',
  concluido: 'bg-linho text-ok border-ok/40',
  faltou: 'bg-transparent text-erro border-erro/40',
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const brl2 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const money = (v: number | null | undefined) =>
  v == null ? '' : Number.isInteger(Number(v)) ? brl.format(Number(v)) : brl2.format(Number(v))

/** Data/hora sempre no fuso de São Paulo, qualquer que seja o aparelho. */
export function spParts(iso: string | Date) {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour') === '24' ? '00' : get('hour')}:${get('minute')}` }
}

export const timeSP = (iso: string) => spParts(iso).time
export const dateSP = (iso: string) => spParts(iso).date

/** "2026-11-21" -> "sábado, 21 de novembro" */
export const longDate = (ymd: string) => format(parseISO(ymd), "EEEE, d 'de' MMMM", { locale: ptBR })
export const shortDate = (ymd: string) => format(parseISO(ymd), "dd/MM/yyyy", { locale: ptBR })
export const monthTitle = (d: Date) => format(d, "MMMM yyyy", { locale: ptBR })

/** Converte data local SP + "HH:mm" em ISO UTC (SP é UTC-3, sem horário de verão desde 2019). */
export const spToIso = (ymd: string, hhmm: string) => new Date(`${ymd}T${hhmm}:00-03:00`).toISOString()

export const todaySP = () => spParts(new Date()).date

export function durationLabel(min: number) {
  const h = Math.floor(min / 60), m = min % 60
  if (!h) return `${m} min`
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

const today = () => todaySP()
export function promoActive(p: ServicePrice, on = today()) {
  return p.promo_price != null && (!p.promo_from || on >= p.promo_from) && (!p.promo_until || on <= p.promo_until)
}
export const effectivePrice = (p: ServicePrice, on?: string) =>
  promoActive(p, on) ? p.promo_price : p.price

/** Texto de preço "a partir de" para listas */
export function priceSummary(s: Service): { label: string; promo: boolean } {
  const rows = s.service_prices.filter((p) => !p.unavailable)
  const vals = rows.map((p) => effectivePrice(p)).filter((v): v is number => v != null)
  const promo = rows.some((p) => promoActive(p))
  if (!vals.length) return { label: 'Sob consulta', promo }
  const min = Math.min(...vals)
  const hasUndefined = rows.some((p) => p.price == null)
  const allSame = vals.every((v) => v === min) && !hasUndefined
  return { label: allSame ? money(min) : `a partir de ${money(min)}`, promo }
}

export function priceFor(s: Service, len: HairLength | null) {
  return s.service_prices.find((p) => (s.price_mode === 'unico' ? p.hair_length == null : p.hair_length === len)) ?? null
}

export const onlyDigits = (s: string) => s.replace(/\D/g, '')
export function maskPhone(v: string) {
  const d = onlyDigits(v).slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

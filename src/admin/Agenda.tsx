import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, parseISO, startOfMonth, startOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { db, friendlyError } from '../lib/supabase'
import { cap, STATUS_LABEL, STATUS_STYLE, dateSP, spToIso, timeSP, todaySP } from '../lib/format'
import type { Appointment, BusinessHour, ScheduleException } from '../lib/types'
import { AdminTitle, toast } from './ui'
import { AppointmentForm } from './AppointmentForm'
import { Arrow, ArrowLeft, Plus } from '../components/Icons'
import type { StaffAbsence } from '../lib/types'
import { useStaff } from './useStaff'

type View = 'mes' | 'semana' | 'dia'
const HOUR_PX = 64
const START_H = 8
const END_H = 20

export default function Agenda() {
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState<View>(() => (window.innerWidth < 768 ? 'dia' : 'semana'))
  const [cursor, setCursor] = useState(() => parseISO(todaySP()))
  const [appts, setAppts] = useState<Appointment[]>([])
  const [hours, setHours] = useState<BusinessHour[]>([])
  const [exceptions, setExceptions] = useState<ScheduleException[]>([])
  const [absences, setAbsences] = useState<StaffAbsence[]>([])
  const { staff } = useStaff()
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [creating, setCreating] = useState<string | null>(params.get('novo') ? todaySP() : null)
  const [showCancelled, setShowCancelled] = useState(false)

  const range = useMemo(() => {
    if (view === 'mes') return { start: startOfWeek(startOfMonth(cursor)), end: endOfWeek(endOfMonth(cursor)) }
    if (view === 'semana') return { start: startOfWeek(cursor), end: endOfWeek(cursor) }
    return { start: cursor, end: cursor }
  }, [view, cursor])
  const days = useMemo(() => eachDayOfInterval(range), [range])

  const load = useCallback(async () => {
    const from = format(range.start, 'yyyy-MM-dd'), to = format(range.end, 'yyyy-MM-dd')
    const [a, h, e, ab] = await Promise.all([
      db().from('appointments').select('*, clients(id, full_name, phone)').gte('starts_at', spToIso(from, '00:00')).lte('starts_at', spToIso(to, '23:59')).order('starts_at'),
      db().from('business_hours').select('*'),
      db().from('schedule_exceptions').select('*').gte('date', from).lte('date', to),
      db().from('staff_absences').select('*').gte('date', from).lte('date', to),
    ])
    setAbsences((ab.data as StaffAbsence[]) ?? [])
    if (a.error) toast(friendlyError(a.error), true)
    setAppts((a.data as Appointment[]) ?? []); setHours((h.data as BusinessHour[]) ?? []); setExceptions((e.data as ScheduleException[]) ?? [])
  }, [range])
  useEffect(() => { void load() }, [load])

  const visible = appts.filter((a) => showCancelled || !['cancelado', 'recusado'].includes(a.status))
  const byDay = (ymd: string) => visible.filter((a) => dateSP(a.starts_at) === ymd)
  const isClosed = (d: Date) => {
    const ymd = format(d, 'yyyy-MM-dd')
    if (exceptions.some((e) => e.date === ymd && e.kind === 'fechado')) return 'Fechado'
    if (exceptions.some((e) => e.date === ymd && e.kind === 'horario_especial')) return null
    return hours.find((h) => h.weekday === d.getDay())?.is_open === false ? 'Fechado' : null
  }
  const staffNote = (ymd: string) => {
    const list = absences.filter((a) => a.date === ymd)
    if (!list.length) return null
    return list.map((a) => `sem ${staff.find((s) => s.id === a.staff_id)?.name ?? '—'}${a.all_day ? '' : ` ${a.from_time?.slice(0, 5)}–${a.to_time?.slice(0, 5)}`}`).join(' · ')
  }
  const staffName = (id: string | null) => (id ? staff.find((s) => s.id === id)?.name : null)
  const move = (dir: number) => setCursor((c) => (view === 'mes' ? addMonths(c, dir) : view === 'semana' ? addWeeks(c, dir) : addDays(c, dir)))
  const title = view === 'mes' ? cap(format(cursor, 'MMMM yyyy', { locale: ptBR }))
    : view === 'semana' ? `${format(range.start, "d MMM", { locale: ptBR })} – ${format(range.end, "d MMM yyyy", { locale: ptBR })}`
    : cap(format(cursor, "EEEE, d 'de' MMMM", { locale: ptBR }))
  const pendingCount = appts.filter((a) => a.status === 'pendente').length

  return (
    <>
      <AdminTitle kicker="Agenda completa" title="Agenda" actions={<button onClick={() => setCreating(format(cursor, 'yyyy-MM-dd'))} className="btn-dark"><Plus /> Novo agendamento</button>} />

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-espresso/15 pb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => move(-1)} className="p-2 hover:bg-white" aria-label="Anterior"><ArrowLeft /></button>
          <button onClick={() => setCursor(parseISO(todaySP()))} className="chip hover:border-espresso">Hoje</button>
          <button onClick={() => move(1)} className="p-2 hover:bg-white" aria-label="Próximo"><Arrow /></button>
          <h2 className="ml-3 font-display text-2xl sm:text-3xl">{title}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-espresso/60"><input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} className="accent-[#2b1f19]" /> mostrar cancelados</label>
          <div className="flex border border-espresso/20">
            {(['dia', 'semana', 'mes'] as View[]).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.16em] ${view === v ? 'bg-espresso text-marfim' : 'hover:bg-white'}`}>{v === 'mes' ? 'Mês' : v}</button>
            ))}
          </div>
        </div>
      </div>
      {pendingCount > 0 && <p className="mt-4 inline-flex items-center gap-2 bg-areia px-3 py-1.5 text-sm"><span className="h-2 w-2 rounded-full bg-bronze" /> {pendingCount} aguardando aprovação neste período — toque no agendamento para confirmar.</p>}

      {view === 'mes' ? (
        <div className="mt-6 overflow-x-auto">
          <div className="grid min-w-[720px] grid-cols-7 border-l border-t border-espresso/10">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => <div key={d} className="border-b border-r border-espresso/10 bg-white/40 p-2 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-espresso/50">{d}</div>)}
            {days.map((d) => {
              const ymd = format(d, 'yyyy-MM-dd'), list = byDay(ymd), closed = isClosed(d)
              return (
                <div key={ymd} onClick={() => { setCursor(d); setView('dia') }}
                  className={`min-h-[118px] cursor-pointer border-b border-r border-espresso/10 p-2 transition hover:bg-white ${!isSameMonth(d, cursor) ? 'opacity-40' : ''} ${closed ? 'bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,rgba(43,31,25,.04)_6px,rgba(43,31,25,.04)_12px)]' : 'bg-white/50'}`}>
                  <div className="flex items-center justify-between"><span className={`text-sm ${ymd === todaySP() ? 'flex h-6 w-6 items-center justify-center rounded-full bg-espresso text-marfim' : ''}`}>{format(d, 'd')}</span>{closed && <span className="text-[0.6rem] uppercase tracking-wider text-espresso/40">{closed}</span>}</div>
                  <ul className="mt-1 space-y-1">
                    {list.slice(0, 4).map((a) => (
                      <li key={a.id}><button onClick={(e) => { e.stopPropagation(); setEditing(a) }} className={`block w-full truncate border-l-2 px-1.5 py-0.5 text-left text-[0.72rem] ${a.status === 'pendente' ? 'border-bronze bg-areia/70' : 'border-espresso bg-linho'}`}>{timeSP(a.starts_at)} {a.clients?.full_name?.split(' ')[0]}</button></li>
                    ))}
                    {list.length > 4 && <li className="text-[0.7rem] text-espresso/55">+{list.length - 4} mais</li>}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <TimeGrid days={days} byDay={byDay} isClosed={isClosed} exceptions={exceptions} onPick={setEditing} staffNote={staffNote} staffName={staffName}
          onEmpty={(ymd) => setCreating(ymd)} />
      )}

      {/* Lista do dia no celular */}
      {view === 'dia' && (
        <ul className="mt-6 divide-y divide-espresso/10 border-y border-espresso/10 md:hidden">
          {byDay(format(cursor, 'yyyy-MM-dd')).length === 0 && <li className="py-6 text-sm text-espresso/55">Nenhum atendimento neste dia.</li>}
          {byDay(format(cursor, 'yyyy-MM-dd')).map((a) => (
            <li key={a.id}><button onClick={() => setEditing(a)} className="flex w-full items-center gap-4 py-4 text-left">
              <span className="w-14 font-display text-2xl">{timeSP(a.starts_at)}</span>
              <span className="flex-1"><span className="block">{a.clients?.full_name}</span><span className="text-sm text-espresso/55">{a.service_name}{staffName(a.staff_id) ? ` · ${staffName(a.staff_id)}` : ''}</span></span>
              <span className={`chip !text-[0.6rem] ${STATUS_STYLE[a.status]}`}>{STATUS_LABEL[a.status]}</span>
            </button></li>
          ))}
        </ul>
      )}

      {(editing || creating) && (
        <AppointmentForm appt={editing} initialDate={creating ?? undefined}
          onClose={() => { setEditing(null); setCreating(null); if (params.get('novo')) setParams({}) }} onSaved={load} />
      )}
    </>
  )
}

function lanes(list: Appointment[]) {
  const sorted = [...list].sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  const ends: number[] = []
  return sorted.map((a) => {
    const s = +new Date(a.starts_at)
    let lane = ends.findIndex((e) => e <= s)
    if (lane === -1) { lane = ends.length; ends.push(0) }
    ends[lane] = +new Date(a.ends_at)
    return { a, lane }
  }).map((x, _i, arr) => ({ ...x, total: Math.max(...arr.filter((y) => +new Date(y.a.starts_at) < +new Date(x.a.ends_at) && +new Date(y.a.ends_at) > +new Date(x.a.starts_at)).map((y) => y.lane)) + 1 }))
}

function TimeGrid({ days, byDay, isClosed, exceptions, onPick, onEmpty, staffNote, staffName }: {
  days: Date[]; byDay: (ymd: string) => Appointment[]; isClosed: (d: Date) => string | null; exceptions: ScheduleException[]
  staffNote: (ymd: string) => string | null; staffName: (id: string | null) => string | null | undefined
  onPick: (a: Appointment) => void; onEmpty: (ymd: string) => void
}) {
  const hoursArr = Array.from({ length: END_H - START_H }, (_, i) => START_H + i)
  const toPx = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return ((h - START_H) * 60 + m) / 60 * HOUR_PX }
  return (
    <div className={`mt-6 overflow-x-auto ${days.length === 1 ? 'hidden md:block' : ''}`}>
      <div className="grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(${days.length > 1 ? 120 : 280}px, 1fr))` }}>
        <div />
        {days.map((d) => {
          const ymd = format(d, 'yyyy-MM-dd')
          return (
            <div key={ymd} className="border-b border-espresso/15 pb-2 text-center">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-espresso/50">{format(d, 'EEE', { locale: ptBR })}</p>
              <p className={`mx-auto mt-1 flex h-9 w-9 items-center justify-center font-display text-2xl ${ymd === todaySP() ? 'rounded-full bg-espresso text-marfim' : ''}`}>{format(d, 'd')}</p>
              <p className="mt-1 h-3 truncate px-1 text-[0.6rem] uppercase tracking-wider text-bronze-texto">{staffNote(ymd) ?? ''}</p>
            </div>
          )
        })}
        <div className="relative">
          {hoursArr.map((h) => <div key={h} style={{ height: HOUR_PX }} className="pr-2 text-right text-[0.7rem] text-espresso/45">{String(h).padStart(2, '0')}:00</div>)}
        </div>
        {days.map((d) => {
          const ymd = format(d, 'yyyy-MM-dd'), closed = isClosed(d)
          return (
            <div key={ymd} onDoubleClick={() => onEmpty(ymd)} className={`relative border-l border-espresso/10 ${closed ? 'bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,rgba(43,31,25,.05)_6px,rgba(43,31,25,.05)_12px)]' : 'bg-white/50'}`} style={{ height: hoursArr.length * HOUR_PX }}>
              {hoursArr.map((h) => <div key={h} className="border-t border-espresso/[.07]" style={{ height: HOUR_PX }} />)}
              {closed && <span className="absolute inset-x-0 top-3 text-center text-[0.65rem] uppercase tracking-[0.2em] text-espresso/40">{closed}</span>}
              {exceptions.filter((e) => e.date === ymd && e.kind === 'bloqueio').map((e) => (
                <div key={e.id} className="absolute inset-x-0 bg-espresso/10 px-2 pt-1 text-[0.65rem] uppercase tracking-wider text-espresso/50" style={{ top: toPx(e.block_from!), height: toPx(e.block_to!) - toPx(e.block_from!) }}>Bloqueado {e.note ? `· ${e.note}` : ''}</div>
              ))}
              {lanes(byDay(ymd)).map(({ a, lane, total }) => {
                const top = toPx(timeSP(a.starts_at))
                const h = Math.max(28, (+new Date(a.ends_at) - +new Date(a.starts_at)) / 3600000 * HOUR_PX - 2)
                return (
                  <button key={a.id} onClick={() => onPick(a)} title={`${a.clients?.full_name} — ${a.service_name}`}
                    className={`absolute overflow-hidden border-l-[3px] px-2 py-1 text-left text-[0.72rem] leading-tight shadow-sm transition hover:z-10 hover:shadow-md ${
                      a.status === 'pendente' ? 'border-bronze bg-areia' : a.status === 'concluido' ? 'border-ok bg-linho' : ['cancelado', 'recusado', 'faltou'].includes(a.status) ? 'border-erro/50 bg-white/80 line-through opacity-60' : 'border-espresso bg-espresso text-marfim'}`}
                    style={{ top, height: h, left: `calc(${(lane / total) * 100}% + 2px)`, width: `calc(${100 / total}% - 4px)` }}>
                    <span className="font-semibold">{timeSP(a.starts_at)}</span> {a.clients?.full_name}
                    <span className="block opacity-75">{a.service_name}{staffName(a.staff_id) ? ` · ${staffName(a.staff_id)}` : ''}</span>
                    {a.status === 'pendente' && <span className="block text-[0.6rem] font-semibold uppercase tracking-wider">{a.unverified ? 'conferir dados' : 'aguardando'}</span>}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-xs text-espresso/45">Dica: clique duas vezes em um dia para criar um agendamento.</p>
    </div>
  )
}

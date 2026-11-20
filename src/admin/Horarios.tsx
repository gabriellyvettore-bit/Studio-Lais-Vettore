import { useEffect, useState } from 'react'
import { db, friendlyError } from '../lib/supabase'
import { WEEKDAYS, longDate, todaySP } from '../lib/format'
import type { BookingSettings, BusinessHour, ScheduleException } from '../lib/types'
import { AdminTitle, Field, toast } from './ui'
import { useSiteData } from '../context/SiteData'
import { Trash } from '../components/Icons'
import { Equipe } from './Equipe'

export default function Horarios() {
  const { settings, reload } = useSiteData()
  const [hours, setHours] = useState<BusinessHour[]>([])
  const [ex, setEx] = useState<ScheduleException[]>([])
  const [bk, setBk] = useState<BookingSettings>(settings.booking)
  const [nx, setNx] = useState({ date: todaySP(), kind: 'fechado' as ScheduleException['kind'], first_start: '09:00', last_start: '16:00', block_from: '12:00', block_to: '13:00', note: '' })

  async function load() {
    const [h, e, s] = await Promise.all([
      db().from('business_hours').select('*').order('weekday'),
      db().from('schedule_exceptions').select('*').gte('date', todaySP()).order('date'),
      db().from('site_settings').select('value').eq('key', 'booking').maybeSingle(),
    ])
    setHours((h.data as BusinessHour[]) ?? []); setEx((e.data as ScheduleException[]) ?? [])
    if (s.data) setBk({ ...settings.booking, ...(s.data.value as BookingSettings) })
  }
  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function saveHours() {
    for (const h of hours) if (h.first_start > h.last_start) return toast(`${WEEKDAYS[h.weekday]}: o primeiro horário deve ser antes do último`, true)
    const { error } = await db().from('business_hours').upsert(hours.map((h) => ({ ...h, first_start: h.first_start.slice(0, 5), last_start: h.last_start.slice(0, 5) })))
    if (error) return toast(friendlyError(error), true)
    toast('Horário semanal salvo')
  }
  async function saveBooking() {
    const { error } = await db().from('site_settings').upsert({ key: 'booking', value: bk })
    if (error) return toast(friendlyError(error), true)
    toast('Regras salvas'); void reload()
  }
  async function addException(e: React.FormEvent) {
    e.preventDefault()
    const row = {
      date: nx.date, kind: nx.kind, note: nx.note || null,
      first_start: nx.kind === 'horario_especial' ? nx.first_start : null, last_start: nx.kind === 'horario_especial' ? nx.last_start : null,
      block_from: nx.kind === 'bloqueio' ? nx.block_from : null, block_to: nx.kind === 'bloqueio' ? nx.block_to : null,
    }
    const { error } = await db().from('schedule_exceptions').insert(row)
    if (error) return toast(friendlyError(error), true)
    toast('Exceção adicionada'); setNx({ ...nx, note: '' }); void load()
  }
  async function delException(id: string) {
    const { error } = await db().from('schedule_exceptions').delete().eq('id', id)
    if (error) return toast(friendlyError(error), true)
    void load()
  }
  const setH = (i: number, p: Partial<BusinessHour>) => setHours((hs) => hs.map((h, k) => (k === i ? { ...h, ...p } : h)))
  const order = [2, 3, 4, 5, 6, 0, 1]

  return (
    <>
      <AdminTitle kicker="Configuração da agenda" title="Horários e equipe" />
      <div className="grid gap-8 xl:grid-cols-2">
        <section className="panel p-6">
          <h2 className="text-3xl">Semana padrão</h2>
          <p className="mt-1 text-sm text-espresso/55">Primeiro e último horário em que a cliente pode <em>começar</em> um atendimento.</p>
          <ul className="mt-6 divide-y divide-espresso/10">
            {order.map((wd) => {
              const i = hours.findIndex((h) => h.weekday === wd)
              const h = hours[i]
              if (!h) return null
              return (
                <li key={wd} className="flex flex-wrap items-center gap-4 py-3">
                  <label className="flex w-36 items-center gap-2"><input type="checkbox" className="accent-[#2b1f19]" checked={h.is_open} onChange={(e) => setH(i, { is_open: e.target.checked })} /> {WEEKDAYS[wd]}</label>
                  {h.is_open ? (
                    <span className="flex items-center gap-2 text-sm">
                      <input type="time" className="field-box !w-28 !py-1.5" value={h.first_start.slice(0, 5)} onChange={(e) => setH(i, { first_start: e.target.value })} /> até
                      <input type="time" className="field-box !w-28 !py-1.5" value={h.last_start.slice(0, 5)} onChange={(e) => setH(i, { last_start: e.target.value })} />
                    </span>
                  ) : <span className="text-sm text-espresso/45">Fechado</span>}
                </li>
              )
            })}
          </ul>
          <button onClick={saveHours} className="btn-dark mt-6">Salvar semana</button>
        </section>

        <section className="panel p-6">
          <h2 className="text-3xl">Dias especiais</h2>
          <p className="mt-1 text-sm text-espresso/55">Feche um dia, mude o horário de uma data ou bloqueie um intervalo. Vale mais do que a semana padrão.</p>
          <form onSubmit={addException} className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="Data"><input type="date" min={todaySP()} className="field-box" value={nx.date} onChange={(e) => setNx({ ...nx, date: e.target.value })} required /></Field>
            <Field label="Tipo">
              <select className="field-box" value={nx.kind} onChange={(e) => setNx({ ...nx, kind: e.target.value as ScheduleException['kind'] })}>
                <option value="fechado">Agenda fechada o dia todo</option>
                <option value="horario_especial">Horário diferente</option>
                <option value="bloqueio">Bloquear um intervalo</option>
              </select>
            </Field>
            {nx.kind === 'horario_especial' && <>
              <Field label="Primeiro horário"><input type="time" className="field-box" value={nx.first_start} onChange={(e) => setNx({ ...nx, first_start: e.target.value })} /></Field>
              <Field label="Último horário"><input type="time" className="field-box" value={nx.last_start} onChange={(e) => setNx({ ...nx, last_start: e.target.value })} /></Field>
            </>}
            {nx.kind === 'bloqueio' && <>
              <Field label="Das"><input type="time" className="field-box" value={nx.block_from} onChange={(e) => setNx({ ...nx, block_from: e.target.value })} /></Field>
              <Field label="Até"><input type="time" className="field-box" value={nx.block_to} onChange={(e) => setNx({ ...nx, block_to: e.target.value })} /></Field>
            </>}
            <Field label="Motivo (só você vê)" className="sm:col-span-2"><input className="field-box" value={nx.note} onChange={(e) => setNx({ ...nx, note: e.target.value })} placeholder="Ex.: feriado, curso, médico" maxLength={300} /></Field>
            <button className="btn-dark sm:col-span-2 sm:justify-self-start">Adicionar</button>
          </form>
          <ul className="mt-6 divide-y divide-espresso/10 border-t border-espresso/10">
            {ex.length === 0 && <li className="py-4 text-sm text-espresso/50">Nenhum dia especial programado.</li>}
            {ex.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span>
                  <span>{longDate(e.date)}</span> — {e.kind === 'fechado' ? 'fechado' : e.kind === 'horario_especial' ? `das ${e.first_start?.slice(0, 5)} às ${e.last_start?.slice(0, 5)}` : `bloqueado ${e.block_from?.slice(0, 5)}–${e.block_to?.slice(0, 5)}`}
                  {e.note && <span className="text-espresso/50"> · {e.note}</span>}
                </span>
                <button onClick={() => delException(e.id)} className="p-2 text-erro" aria-label="Remover"><Trash /></button>
              </li>
            ))}
          </ul>
        </section>

        <Equipe />

        <section className="panel p-6 xl:col-span-2">
          <h2 className="text-3xl">Regras do agendamento online</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-3">
            <Field label="Antecedência mínima (horas)"><input type="number" min={0} max={168} className="field-box" value={bk.min_advance_hours} onChange={(e) => setBk({ ...bk, min_advance_hours: Number(e.target.value) })} /></Field>
            <Field label="Cancelar online até (horas antes)"><input type="number" min={0} max={168} className="field-box" value={bk.cancel_hours} onChange={(e) => setBk({ ...bk, cancel_hours: Number(e.target.value) })} /></Field>
            <Field label="Intervalo entre horários (min)"><select className="field-box" value={bk.slot_step_min} onChange={(e) => setBk({ ...bk, slot_step_min: Number(e.target.value) })}>{[15, 30, 60].map((v) => <option key={v} value={v}>{v} min</option>)}</select></Field>
            <Field label="Agenda aberta para os próximos (dias)"><input type="number" min={7} max={365} className="field-box" value={bk.horizon_days} onChange={(e) => setBk({ ...bk, horizon_days: Number(e.target.value) })} /></Field>
            <Field label="Máx. pedidos pendentes por cliente"><input type="number" min={1} max={10} className="field-box" value={bk.max_pending_per_client} onChange={(e) => setBk({ ...bk, max_pending_per_client: Number(e.target.value) })} /></Field>
          </div>
          <button onClick={saveBooking} className="btn-dark mt-6">Salvar regras</button>
        </section>
      </div>
    </>
  )
}

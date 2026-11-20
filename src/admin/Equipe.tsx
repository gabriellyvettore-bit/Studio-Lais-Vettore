import { useEffect, useState } from 'react'
import { db, friendlyError } from '../lib/supabase'
import { longDate, todaySP } from '../lib/format'
import type { StaffAbsence } from '../lib/types'
import { Field, toast } from './ui'
import { useStaff } from './useStaff'
import { Plus, Trash } from '../components/Icons'

/** Equipe e ausências: define quantas clientes cabem em cada horário. */
export function Equipe() {
  const { staff, reload } = useStaff()
  const [abs, setAbs] = useState<StaffAbsence[]>([])
  const [newName, setNewName] = useState('')
  const [f, setF] = useState({ staff_id: '', date: todaySP(), all_day: true, from_time: '09:00', to_time: '12:00', note: '' })

  async function loadAbs() {
    const { data } = await db().from('staff_absences').select('*').gte('date', todaySP()).order('date')
    setAbs((data as StaffAbsence[]) ?? [])
  }
  useEffect(() => { void loadAbs() }, [])
  useEffect(() => { if (!f.staff_id && staff[0]) setF((x) => ({ ...x, staff_id: staff[0].id })) }, [staff, f.staff_id])

  const active = staff.filter((s) => s.active)
  const nameOf = (id: string) => staff.find((s) => s.id === id)?.name ?? '—'

  async function addStaff() {
    if (newName.trim().length < 2) return toast('Informe o nome', true)
    const { error } = await db().from('staff').insert({ name: newName.trim(), sort_order: staff.length + 1 })
    if (error) return toast(friendlyError(error), true)
    setNewName(''); toast('Atendente adicionada'); void reload()
  }
  async function toggle(id: string, activeNow: boolean) {
    const { error } = await db().from('staff').update({ active: !activeNow }).eq('id', id)
    if (error) return toast(friendlyError(error), true)
    void reload()
  }
  async function rename(id: string, name: string) {
    if (name.trim().length < 2) return
    const { error } = await db().from('staff').update({ name: name.trim() }).eq('id', id)
    if (error) return toast(friendlyError(error), true)
    void reload()
  }
  async function addAbsence(e: React.FormEvent) {
    e.preventDefault()
    if (!f.staff_id) return
    const { error } = await db().from('staff_absences').insert({
      staff_id: f.staff_id, date: f.date, all_day: f.all_day, note: f.note || null,
      from_time: f.all_day ? null : f.from_time, to_time: f.all_day ? null : f.to_time,
    })
    if (error) return toast(friendlyError(error), true)
    toast('Registrado — a agenda online já considera'); setF({ ...f, note: '' }); void loadAbs()
  }
  async function delAbsence(id: string) {
    const { error } = await db().from('staff_absences').delete().eq('id', id)
    if (error) return toast(friendlyError(error), true)
    void loadAbs()
  }

  return (
    <section className="panel p-6 xl:col-span-2">
      <h2 className="text-3xl">Equipe</h2>
      <p className="mt-1 max-w-2xl text-sm text-espresso/55">
        Cada atendente presente libera uma cliente por horário. Hoje: <strong>{active.length} {active.length === 1 ? 'atendente' : 'atendentes'}</strong> — até {active.length} {active.length === 1 ? 'cliente' : 'clientes'} no mesmo horário.
        Em “Serviços e preços” você escolhe quem faz cada serviço (ex.: mechas só a Laís).
      </p>
      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <div>
          <span className="label">Atendentes</span>
          <ul className="mt-2 divide-y divide-espresso/10 border-y border-espresso/10">
            {staff.map((s) => (
              <li key={s.id} className={`flex items-center gap-3 py-2 ${!s.active ? 'opacity-50' : ''}`}>
                <input className="field-box flex-1 !py-1.5" defaultValue={s.name} maxLength={60} onBlur={(e) => e.target.value !== s.name && rename(s.id, e.target.value)} aria-label="Nome da atendente" />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[#2b1f19]" checked={s.active} onChange={() => toggle(s.id, s.active)} /> ativa</label>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <input className="field-box !py-1.5" placeholder="Nova atendente" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={60} />
            <button type="button" onClick={addStaff} className="btn-line !px-4 !py-2"><Plus /> Adicionar</button>
          </div>
        </div>

        <div>
          <span className="label">Quem não vai atender</span>
          <p className="text-xs text-espresso/50">Ex.: “só a Laís no sábado” = marque a Gabi ausente no sábado.</p>
          <form onSubmit={addAbsence} className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Atendente">
              <select className="field-box" value={f.staff_id} onChange={(e) => setF({ ...f, staff_id: e.target.value })}>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Data"><input type="date" min={todaySP()} className="field-box" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required /></Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" className="accent-[#2b1f19]" checked={f.all_day} onChange={(e) => setF({ ...f, all_day: e.target.checked })} /> O dia todo</label>
            {!f.all_day && <>
              <Field label="Das"><input type="time" className="field-box" value={f.from_time} onChange={(e) => setF({ ...f, from_time: e.target.value })} /></Field>
              <Field label="Até"><input type="time" className="field-box" value={f.to_time} onChange={(e) => setF({ ...f, to_time: e.target.value })} /></Field>
            </>}
            <Field label="Motivo (opcional)" className="sm:col-span-2"><input className="field-box" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={300} /></Field>
            <button className="btn-dark sm:col-span-2 sm:justify-self-start">Registrar</button>
          </form>
          <ul className="mt-4 divide-y divide-espresso/10 border-t border-espresso/10">
            {abs.length === 0 && <li className="py-3 text-sm text-espresso/50">Equipe completa em todos os próximos dias.</li>}
            {abs.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span><strong className="font-semibold">{nameOf(a.staff_id)}</strong> ausente · <span className="capitalize">{longDate(a.date)}</span> {a.all_day ? '(dia todo)' : `das ${a.from_time?.slice(0, 5)} às ${a.to_time?.slice(0, 5)}`}{a.note && <span className="text-espresso/50"> · {a.note}</span>}</span>
                <button onClick={() => delAbsence(a.id)} className="p-2.5 text-erro" aria-label="Remover"><Trash /></button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

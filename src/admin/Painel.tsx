import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { db, friendlyError } from '../lib/supabase'
import { STATUS_LABEL, STATUS_STYLE, dateSP, lengthLabel, longDate, money, spToIso, timeSP, todaySP } from '../lib/format'
import { waClient } from '../lib/whatsapp'
import type { Appointment } from '../lib/types'
import { AdminTitle, toast } from './ui'
import { AppointmentForm } from './AppointmentForm'
import { Check, Close, Edit, Plus, Whats } from '../components/Icons'

/** Apaga do Storage as fotos de clientes que excluíram os dados (LGPD). */
async function purgeStorage() {
  const { data } = await db().from('storage_purge').select('path').limit(500)
  const paths = (data ?? []).map((r) => r.path as string)
  if (!paths.length) return
  const { error } = await db().storage.from('clientes').remove(paths)
  if (!error) await db().from('storage_purge').delete().in('path', paths)
}

export const confirmMsg = (a: Appointment) =>
  `Olá, ${a.clients?.full_name?.split(' ')[0] ?? ''}! Seu horário no Studio Lais Vettore está confirmado: ${a.service_name}, ${longDate(dateSP(a.starts_at)).toLowerCase()} às ${timeSP(a.starts_at)}. Te esperamos! Rua Jacareí, 128 — Vila Rosália.`

export default function Painel() {
  const [today, setToday] = useState<Appointment[]>([])
  const [pending, setPending] = useState<Appointment[]>([])
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [creating, setCreating] = useState(false)
  const [justConfirmed, setJustConfirmed] = useState<Appointment | null>(null)
  const t = todaySP()

  async function load() {
    const [a, b] = await Promise.all([
      db().from('appointments').select('*, clients(id, full_name, phone)').gte('starts_at', spToIso(t, '00:00')).lte('starts_at', spToIso(t, '23:59')).in('status', ['pendente', 'confirmado', 'concluido']).order('starts_at'),
      db().from('appointments').select('*, clients(id, full_name, phone)').eq('status', 'pendente').gte('starts_at', new Date().toISOString()).order('starts_at'),
    ])
    if (a.error || b.error) toast(friendlyError(a.error ?? b.error), true)
    setToday((a.data as Appointment[]) ?? []); setPending((b.data as Appointment[]) ?? [])
  }
  useEffect(() => { void load(); void purgeStorage() }, [])

  async function setStatus(a: Appointment, status: 'confirmado' | 'recusado') {
    if (status === 'recusado' && !confirm(`Recusar o pedido de ${a.clients?.full_name}?`)) return
    const { error } = await db().from('appointments').update({ status }).eq('id', a.id)
    if (error) return toast(friendlyError(error), true)
    toast(status === 'confirmado' ? 'Confirmado!' : 'Pedido recusado')
    if (status === 'confirmado') setJustConfirmed(a)
    void load()
  }

  return (
    <>
      <AdminTitle kicker={longDate(t)} title="Olá, Laís!" actions={<button onClick={() => setCreating(true)} className="btn-dark"><Plus /> Novo agendamento</button>} />

      {justConfirmed && (
        <div className="mb-6 flex flex-col gap-3 bg-espresso p-4 text-marfim sm:flex-row sm:items-center sm:justify-between">
          <p><Check className="mr-1 inline" /> Horário de <strong>{justConfirmed.clients?.full_name}</strong> confirmado.</p>
          <div className="flex gap-2">
            {waClient(justConfirmed.clients?.phone, confirmMsg(justConfirmed)) && (
              <a href={waClient(justConfirmed.clients?.phone, confirmMsg(justConfirmed))!} target="_blank" rel="noopener noreferrer" onClick={() => setJustConfirmed(null)} className="btn-light flex-1 !min-h-12"><Whats /> Avisar no WhatsApp</a>
            )}
            <button onClick={() => setJustConfirmed(null)} className="p-3" aria-label="Fechar"><Close /></button>
          </div>
        </div>
      )}

      <section>
        <h2 className="text-[1.8rem] leading-none">Pedidos novos {pending.length > 0 && <span className="ml-1 inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-bronze px-2 font-sans text-base text-marfim">{pending.length}</span>}</h2>
        {pending.length === 0 ? <p className="mt-3 text-espresso/60">Nenhum pedido esperando.</p> : (
          <ul className="mt-4 grid gap-3 xl:grid-cols-2">
            {pending.map((a) => (
              <li key={a.id} className="panel bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-[1.6rem] leading-tight">{a.clients?.full_name}</p>
                    <p className="text-[1rem]">{a.service_name}{a.hair_length ? ` · ${lengthLabel(a.hair_length)}` : ''}</p>
                    <p className="text-[1rem] font-semibold">{longDate(dateSP(a.starts_at))}, {timeSP(a.starts_at)}</p>
                    <p className="text-[0.9rem] text-espresso/60">{a.price != null ? money(a.price) : 'valor a combinar'}</p>
                  </div>
                  {waClient(a.clients?.phone, `Olá, ${a.clients?.full_name?.split(' ')[0]}! Aqui é do Studio Lais Vettore, sobre seu pedido de ${a.service_name}…`) && (
                    <a href={waClient(a.clients?.phone, `Olá, ${a.clients?.full_name?.split(' ')[0]}! Aqui é do Studio Lais Vettore, sobre seu pedido de ${a.service_name}…`)!} target="_blank" rel="noopener noreferrer" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-espresso/20" aria-label="Conversar no WhatsApp"><Whats width={22} height={22} /></a>
                  )}
                </div>
                {a.unverified && <p className="mt-2 border-l-4 border-erro/60 bg-erro/5 p-2 text-[0.9rem]"><strong>Dados não conferem:</strong> pedido feito com o celular desta cliente, mas a pessoa digitou o nome “{a.guest_name}” e um nascimento diferente. Confirme pelo WhatsApp antes.</p>}
                {a.client_note && <p className="mt-2 bg-linho p-2 text-[0.9rem] italic">“{a.client_note}”</p>}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button onClick={() => setStatus(a, 'confirmado')} className="btn-dark !px-2 text-[0.75rem]"><Check /> Confirmar</button>
                  <button onClick={() => setEditing(a)} className="btn border border-espresso/30 !px-2 text-[0.75rem]"><Edit /> Editar</button>
                  <button onClick={() => setStatus(a, 'recusado')} className="btn border border-erro/40 !px-2 text-[0.75rem] text-erro"><Close /> Recusar</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <div className="flex items-end justify-between"><h2 className="text-[1.8rem] leading-none">Hoje</h2><Link to="/admin/agenda" className="btn-ghost min-h-11 !text-[0.72rem]">Agenda completa</Link></div>
        {today.length === 0 ? <p className="mt-3 text-espresso/60">Nenhum atendimento hoje.</p> : (
          <ul className="panel mt-4 divide-y divide-espresso/10 bg-white">
            {today.map((a) => (
              <li key={a.id}><button onClick={() => setEditing(a)} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left">
                <span className="w-14 shrink-0 font-display text-2xl">{timeSP(a.starts_at)}</span>
                <span className="min-w-0 flex-1"><span className="block truncate">{a.clients?.full_name}</span><span className="block truncate text-[0.9rem] text-espresso/60">{a.service_name}</span></span>
                <span className={`chip shrink-0 !text-[0.6rem] ${STATUS_STYLE[a.status]}`}>{STATUS_LABEL[a.status]}</span>
              </button></li>
            ))}
          </ul>
        )}
      </section>

      {(editing || creating) && <AppointmentForm appt={editing} onClose={() => { setEditing(null); setCreating(false) }} onSaved={load} />}
    </>
  )
}

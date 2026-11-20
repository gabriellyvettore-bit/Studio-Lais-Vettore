import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { db, friendlyError } from '../lib/supabase'
import { STATUS_LABEL, STATUS_STYLE, dateSP, longDate, money, spToIso, timeSP, todaySP } from '../lib/format'
import type { Appointment } from '../lib/types'
import { AdminTitle, toast } from './ui'
import { Arrow } from '../components/Icons'
import { useAuth } from '../context/Auth'

/** Apaga do Storage as fotos de clientes que excluíram a conta (LGPD). */
async function purgeStorage() {
  const { data } = await db().from('storage_purge').select('path').limit(500)
  const paths = (data ?? []).map((r) => r.path as string)
  if (!paths.length) return
  const { error } = await db().storage.from('clientes').remove(paths)
  if (!error) await db().from('storage_purge').delete().in('path', paths)
}

export default function Painel() {
  const { profile, session } = useAuth()
  const [today, setToday] = useState<Appointment[]>([])
  const [pending, setPending] = useState<Appointment[]>([])
  const [month, setMonth] = useState<Appointment[]>([])
  const t = todaySP()

  async function load() {
    const startMonth = spToIso(t.slice(0, 8) + '01', '00:00')
    const [a, b, c] = await Promise.all([
      db().from('appointments').select('*, clients(id, full_name, phone)').gte('starts_at', spToIso(t, '00:00')).lte('starts_at', spToIso(t, '23:59')).in('status', ['pendente', 'confirmado', 'concluido']).order('starts_at'),
      db().from('appointments').select('*, clients(id, full_name, phone)').eq('status', 'pendente').gte('starts_at', new Date().toISOString()).order('starts_at'),
      db().from('appointments').select('*').gte('starts_at', startMonth).in('status', ['confirmado', 'concluido']),
    ])
    if (a.error || b.error || c.error) toast(friendlyError(a.error ?? b.error ?? c.error), true)
    setToday((a.data as Appointment[]) ?? []); setPending((b.data as Appointment[]) ?? []); setMonth((c.data as Appointment[]) ?? [])
  }
  useEffect(() => { void load(); void purgeStorage() }, [])

  async function setStatus(id: string, status: 'confirmado' | 'recusado') {
    const { error } = await db().from('appointments').update({ status }).eq('id', id)
    if (error) return toast(friendlyError(error), true)
    toast(status === 'confirmado' ? 'Agendamento confirmado' : 'Agendamento recusado'); void load()
  }

  const revenue = month.filter((m) => m.status === 'concluido').reduce((s, m) => s + Number(m.price ?? 0), 0)
  const top = Object.entries(month.reduce<Record<string, number>>((acc, m) => ({ ...acc, [m.service_name]: (acc[m.service_name] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]).slice(0, 4)
  const name = profile?.full_name?.split(' ')[0] ?? session?.user.user_metadata?.name?.split(' ')[0] ?? 'Laís'

  return (
    <>
      <AdminTitle kicker={<span>{longDate(t)}</span>} title={`Olá, ${name}.`} actions={<Link to="/admin/agenda?novo=1" className="btn-dark">Novo agendamento</Link>} />
      <div className="grid gap-4 sm:grid-cols-3">
        {[['Hoje', today.length, 'atendimentos'], ['Aguardando', pending.length, 'para aprovar'], ['No mês', month.length, `confirmados · ${money(revenue)} concluído`]].map(([k, v, s]) => (
          <div key={k as string} className="panel p-6"><p className="label">{k}</p><p className="mt-2 font-display text-5xl">{v}</p><p className="mt-1 text-sm text-espresso/55">{s}</p></div>
        ))}
      </div>

      <div className="mt-10 grid gap-8 xl:grid-cols-2">
        <section className="panel p-6">
          <div className="flex items-center justify-between"><h2 className="text-3xl">Aguardando aprovação</h2><Link to="/admin/agenda" className="btn-ghost !text-[0.7rem]">Agenda <Arrow /></Link></div>
          {pending.length === 0 ? <p className="mt-4 text-sm text-espresso/55">Nada pendente.</p> : (
            <ul className="mt-4 divide-y divide-espresso/10">
              {pending.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <p className="font-display text-xl">{a.clients?.full_name}</p>
                    <p className="text-sm text-espresso/60">{a.service_name} · {longDate(dateSP(a.starts_at))} {timeSP(a.starts_at)}</p>
                    {a.client_note && <p className="mt-1 text-sm italic text-espresso/55">“{a.client_note}”</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setStatus(a.id, 'confirmado')} className="btn-dark !px-4 !py-2.5">Confirmar</button>
                    <button onClick={() => setStatus(a.id, 'recusado')} className="btn-line !px-4 !py-2.5">Recusar</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="panel p-6">
          <h2 className="text-3xl">Hoje</h2>
          {today.length === 0 ? <p className="mt-4 text-sm text-espresso/55">Nenhum atendimento hoje.</p> : (
            <ul className="mt-4 divide-y divide-espresso/10">
              {today.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                  <span className="w-14 font-display text-2xl">{timeSP(a.starts_at)}</span>
                  <Link to={`/admin/clientes/${a.client_id}`} className="flex-1 hover:underline"><span className="block">{a.clients?.full_name}</span><span className="text-sm text-espresso/55">{a.service_name}</span></Link>
                  <span className={`chip ${STATUS_STYLE[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                </li>
              ))}
            </ul>
          )}
          {top.length > 0 && (
            <div className="mt-8 border-t border-espresso/10 pt-6">
              <p className="label">Mais procurados no mês</p>
              <ul className="mt-3 space-y-2">{top.map(([n, c]) => <li key={n} className="flex justify-between text-sm"><span>{n}</span><span className="text-espresso/55">{c}</span></li>)}</ul>
            </div>
          )}
        </section>
      </div>
    </>
  )
}

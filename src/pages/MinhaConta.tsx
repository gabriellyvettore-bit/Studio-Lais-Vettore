import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/Auth'
import { useSiteData } from '../context/SiteData'
import { supabase, isConfigured, friendlyError } from '../lib/supabase'
import { STATUS_LABEL, STATUS_STYLE, dateSP, lengthLabel, longDate, money, shortDate, timeSP } from '../lib/format'
import { contactLink } from '../lib/whatsapp'
import type { AppointmentStatus, HairLength } from '../lib/types'
import { LoginBox, ProfileForm } from '../components/AuthForms'
import { Logout, Whats } from '../components/Icons'
import { NotReady } from './Agendar'

interface MyAppt { id: string; service_name: string; hair_length: HairLength | null; starts_at: string; ends_at: string; status: AppointmentStatus; price: number | null; price_note: string | null; client_note: string | null }
interface MyHist { id: string; performed_on: string; service_name: string; hair_length: HairLength | null; price: number | null; client_notes: string | null }

export default function MinhaConta() {
  const { session, profile, ready, who, signOut } = useAuth()
  const [tab, setTab] = useState<'agenda' | 'historico' | 'dados'>('agenda')

  if (!isConfigured) return <NotReady />
  if (!ready) return <div className="min-h-[70vh] pt-40 text-center text-espresso/50">Carregando…</div>
  if (!session) return (
    <section className="mx-auto max-w-md px-5 pb-24 pt-36"><LoginBox title="Entre na sua conta" /></section>
  )
  if (who?.is_admin_account) return <Navigate to="/admin" replace />

  if (!profile) return (
    <section className="mx-auto max-w-xl px-5 pb-24 pt-36 sm:px-8">
      <p className="kicker">Bem-vinda</p>
      <h1 className="mt-4 text-5xl leading-none">Complete seu <em className="text-cacau">cadastro.</em></h1>
      <div className="mt-10"><ProfileForm submitLabel="Criar minha conta" /></div>
    </section>
  )

  return (
    <section className="mx-auto max-w-[1100px] px-5 pb-28 pt-32 sm:px-8 sm:pt-40">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="kicker">Minha conta</p>
          <h1 className="mt-4 text-[clamp(2.8rem,6vw,4.6rem)] leading-none">Olá, <em className="text-cacau">{profile.full_name.split(' ')[0]}.</em></h1>
        </div>
        <div className="flex gap-4">
          <Link to="/agendar" className="btn-dark">Novo agendamento</Link>
          <button onClick={signOut} className="btn-ghost"><Logout /> Sair</button>
        </div>
      </div>
      <div role="tablist" className="no-scrollbar -mx-5 mt-12 flex gap-6 overflow-x-auto whitespace-nowrap border-b border-espresso/15 px-5 sm:mx-0 sm:gap-8 sm:px-0">
        {([['agenda', 'Agendamentos'], ['historico', 'Meu histórico'], ['dados', 'Meus dados']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`-mb-px border-b-2 pb-4 text-[0.74rem] font-semibold uppercase tracking-[0.18em] transition ${tab === k ? 'border-espresso text-espresso' : 'border-transparent text-espresso/45 hover:text-espresso'}`}>{l}</button>
        ))}
      </div>
      <div className="mt-10">
        {tab === 'agenda' && <Appointments />}
        {tab === 'historico' && <History />}
        {tab === 'dados' && <MyData />}
      </div>
    </section>
  )
}

function Appointments() {
  const { settings } = useSiteData()
  const [list, setList] = useState<MyAppt[] | null>(null)
  const [err, setErr] = useState('')
  const load = useCallback(async () => {
    const { data, error } = await supabase!.rpc('get_my_appointments')
    if (error) setErr(friendlyError(error))
    setList((data as MyAppt[]) ?? [])
  }, [])
  useEffect(() => { void load() }, [load])

  async function cancel(a: MyAppt) {
    if (!confirm(`Cancelar ${a.service_name} em ${shortDate(dateSP(a.starts_at))} às ${timeSP(a.starts_at)}?`)) return
    const { error } = await supabase!.rpc('cancel_my_appointment', { p_id: a.id })
    if (error) return alert(friendlyError(error))
    void load()
  }

  if (!list) return <p className="text-espresso/50">Carregando…</p>
  const now = Date.now()
  const upcoming = list.filter((a) => new Date(a.starts_at).getTime() >= now && ['pendente', 'confirmado'].includes(a.status)).reverse()
  const past = list.filter((a) => !upcoming.includes(a))

  return (
    <div className="space-y-14">
      {err && <p className="text-sm text-erro">{err}</p>}
      <div>
        <h2 className="text-3xl">Próximos</h2>
        {upcoming.length === 0 ? (
          <p className="mt-4 text-espresso/60">Nenhum horário marcado. <Link to="/agendar" className="underline">Que tal agendar?</Link></p>
        ) : (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {upcoming.map((a) => (
              <li key={a.id} className="panel flex flex-col p-6">
                <span className={`chip self-start ${STATUS_STYLE[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                <p className="mt-5 font-display text-3xl leading-none">{a.service_name}</p>
                <p className="mt-3 capitalize text-espresso/70">{longDate(dateSP(a.starts_at))} · {timeSP(a.starts_at)}</p>
                <p className="mt-1 text-sm text-espresso/55">{[lengthLabel(a.hair_length), a.price != null ? money(a.price) : a.price_note].filter(Boolean).join(' · ')}</p>
                <div className="mt-6 flex flex-wrap gap-5 border-t border-espresso/10 pt-4">
                  <button onClick={() => cancel(a)} className="btn-ghost !text-[0.7rem] !text-erro decoration-erro/40">Cancelar</button>
                  <a href={contactLink(settings.contact, `Olá! Sobre meu agendamento de ${a.service_name} em ${shortDate(dateSP(a.starts_at))} às ${timeSP(a.starts_at)}…`)} target="_blank" rel="noopener noreferrer" className="btn-ghost !text-[0.7rem]"><Whats width={14} /> Remarcar / dúvidas</a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {past.length > 0 && (
        <div>
          <h2 className="text-3xl">Anteriores</h2>
          <ul className="mt-6 divide-y divide-espresso/10 border-y border-espresso/10">
            {past.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
                <span><strong className="font-display text-xl font-normal">{a.service_name}</strong> <span className="text-espresso/55">· {shortDate(dateSP(a.starts_at))} {timeSP(a.starts_at)}</span></span>
                <span className={`chip ${STATUS_STYLE[a.status]}`}>{STATUS_LABEL[a.status]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function History() {
  const [list, setList] = useState<MyHist[] | null>(null)
  useEffect(() => { supabase!.rpc('get_my_history').then(({ data }) => setList((data as MyHist[]) ?? [])) }, [])
  if (!list) return <p className="text-espresso/50">Carregando…</p>
  if (!list.length) return <p className="text-espresso/60">Seu histórico de procedimentos aparecerá aqui depois do seu primeiro atendimento.</p>
  return (
    <ol className="relative border-l border-espresso/15 pl-8">
      {list.map((h) => (
        <li key={h.id} className="relative pb-10 last:pb-0">
          <span className="absolute -left-[37px] top-1.5 h-2.5 w-2.5 rounded-full bg-bronze ring-4 ring-marfim" />
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-cacau">{shortDate(h.performed_on)}</p>
          <p className="mt-1 font-display text-3xl">{h.service_name}</p>
          <p className="text-sm text-espresso/55">{[lengthLabel(h.hair_length), money(h.price)].filter(Boolean).join(' · ')}</p>
          {h.client_notes && <p className="mt-3 max-w-xl border-l-2 border-areia pl-4 text-[0.95rem] italic text-espresso/75">{h.client_notes}</p>}
        </li>
      ))}
      <p className="mt-6 text-xs text-espresso/45">O histórico é registrado pelo studio e não pode ser alterado por aqui.</p>
    </ol>
  )
}

function MyData() {
  const { signOut } = useAuth()
  const [busy, setBusy] = useState(false)
  async function exportData() {
    const { data, error } = await supabase!.rpc('export_my_data')
    if (error) return alert(friendlyError(error))
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = 'meus-dados-studio-lais-vettore.json'; a.click()
    URL.revokeObjectURL(a.href)
  }
  async function del() {
    const word = prompt('Isso apaga definitivamente sua conta, agendamentos e histórico. Para confirmar, digite EXCLUIR:')
    if (word?.trim().toUpperCase() !== 'EXCLUIR') return
    setBusy(true)
    const { error } = await supabase!.rpc('delete_my_account')
    setBusy(false)
    if (error) return alert(friendlyError(error))
    await signOut()
    location.hash = '#/'
  }
  return (
    <div className="grid gap-14 lg:grid-cols-12">
      <div className="lg:col-span-6"><h2 className="mb-8 text-3xl">Cadastro</h2><ProfileForm /></div>
      <div className="lg:col-span-5 lg:col-start-8">
        <h2 className="text-3xl">Privacidade</h2>
        <p className="mt-3 text-sm leading-relaxed text-espresso/65">Seus dados são seus. Baixe uma cópia completa ou exclua sua conta quando quiser (LGPD).</p>
        <div className="mt-6 flex flex-col items-start gap-4">
          <button onClick={exportData} className="btn-line">Baixar meus dados</button>
          <button onClick={del} disabled={busy} className="btn-ghost !text-erro decoration-erro/40">Excluir minha conta</button>
        </div>
      </div>
    </div>
  )
}

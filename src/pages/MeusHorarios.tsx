import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSiteData } from '../context/SiteData'
import { supabase, isConfigured, friendlyError } from '../lib/supabase'
import { STATUS_LABEL, STATUS_STYLE, dateSP, lengthLabel, longDate, maskPhone, money, shortDate, timeSP } from '../lib/format'
import { contactLink } from '../lib/whatsapp'
import { clearGuest, getGuest, maskBirth, parseBirth, saveGuest, type GuestSession } from '../lib/guest'
import type { AppointmentStatus, HairLength } from '../lib/types'
import { Calendar, Whats } from '../components/Icons'
import { NotReady } from './Agendar'

interface Appt { id: string; service_name: string; hair_length: HairLength | null; starts_at: string; status: AppointmentStatus; price: number | null; price_note: string | null }
interface Hist { id: string; performed_on: string; service_name: string; hair_length: HairLength | null; client_notes: string | null }

export default function MeusHorarios() {
  const [guest, setGuest] = useState<GuestSession | null>(getGuest())
  if (!isConfigured) return <NotReady />
  return (
    <section className="mx-auto max-w-2xl px-5 pb-16 pt-24 sm:px-8 sm:pt-36">
      {guest ? <Lista guest={guest} onExit={() => { clearGuest(); setGuest(null) }} /> : <Entrar onIn={setGuest} />}
    </section>
  )
}

function Entrar({ onIn }: { onIn: (g: GuestSession) => void }) {
  const [phone, setPhone] = useState('')
  const [birth, setBirth] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function go(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    const b = parseBirth(birth)
    if (!b) return setErr('Confira a data de nascimento. Ex.: 25/03/1970')
    setBusy(true)
    const { data, error } = await supabase!.rpc('guest_login', { p_phone: phone, p_birth: b })
    setBusy(false)
    if (error) return setErr(friendlyError(error))
    if (!data) return setErr('Não encontramos. Confira o celular e a data, ou agende pela primeira vez.')
    const g = { token: data.token, first_name: data.first_name, phone } as GuestSession
    saveGuest(g); onIn(g)
  }
  return (
    <>
      <h1 className="text-[2.6rem] leading-none">Meus horários</h1>
      <p className="mt-3 text-[1.05rem] text-espresso/70">Digite o celular e a data de nascimento que você usou no agendamento.</p>
      <form onSubmit={go} className="panel mt-6 space-y-5 p-5 sm:p-8" noValidate>
        <div><label className="label" htmlFor="l-phone">Celular</label>
          <input id="l-phone" className="field-box !py-3 !text-[1.05rem]" inputMode="tel" autoComplete="tel" placeholder="(11) 91234-5678" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} /></div>
        <div><label className="label" htmlFor="l-birth">Data de nascimento</label>
          <input id="l-birth" className="field-box !py-3 !text-[1.05rem]" inputMode="numeric" placeholder="dia/mês/ano" value={birth} onChange={(e) => setBirth(maskBirth(e.target.value))} /></div>
        {err && <p role="alert" className="bg-erro/10 p-3 text-[0.95rem] text-erro">{err}</p>}
        <button disabled={busy} className="btn-dark w-full">{busy ? 'Buscando…' : 'Ver meus horários'}</button>
      </form>
      <Link to="/agendar" className="btn-line mt-4 w-full"><Calendar /> Ainda não agendei</Link>
    </>
  )
}

function Lista({ guest, onExit }: { guest: GuestSession; onExit: () => void }) {
  const { settings } = useSiteData()
  const [list, setList] = useState<Appt[] | null>(null)
  const [hist, setHist] = useState<Hist[]>([])
  const load = useCallback(async () => {
    const [a, h] = await Promise.all([
      supabase!.rpc('guest_appointments', { p_token: guest.token }),
      supabase!.rpc('guest_history', { p_token: guest.token }),
    ])
    const prof = await supabase!.rpc('guest_profile', { p_token: guest.token })
    if (!prof.data) { onExit(); return }   // aparelho esquecido ou dados excluídos
    setList((a.data as Appt[]) ?? []); setHist((h.data as Hist[]) ?? [])
  }, [guest.token, onExit])
  useEffect(() => { void load() }, [load])

  async function cancel(a: Appt) {
    if (!confirm(`Cancelar ${a.service_name} no dia ${shortDate(dateSP(a.starts_at))} às ${timeSP(a.starts_at)}?`)) return
    const { error } = await supabase!.rpc('guest_cancel', { p_token: guest.token, p_id: a.id })
    if (error) return alert(friendlyError(error))
    void load()
  }
  async function exportData() {
    const { data, error } = await supabase!.rpc('guest_export', { p_token: guest.token })
    if (error) return alert(friendlyError(error))
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const el = document.createElement('a'); el.href = url; el.download = 'meus-dados-studio-lais-vettore.json'; el.click(); URL.revokeObjectURL(url)
  }
  async function del() {
    if (prompt('Isso apaga seus dados e horários do studio. Para confirmar, digite EXCLUIR:')?.trim().toUpperCase() !== 'EXCLUIR') return
    const { error } = await supabase!.rpc('guest_delete', { p_token: guest.token })
    if (error) return alert(friendlyError(error))
    onExit()
  }
  async function exit() {
    await supabase!.rpc('guest_logout', { p_token: guest.token })
    onExit()
  }

  const now = Date.now()
  const upcoming = (list ?? []).filter((a) => +new Date(a.starts_at) >= now && ['pendente', 'confirmado'].includes(a.status)).reverse()
  const past = (list ?? []).filter((a) => !upcoming.includes(a))

  return (
    <>
      <h1 className="text-[2.6rem] leading-none">Olá, <em className="text-cacau">{guest.first_name}!</em></h1>
      <Link to="/agendar" className="btn-dark mt-6 w-full"><Calendar /> Agendar novo horário</Link>

      <h2 className="mt-10 text-[1.8rem]">Próximos horários</h2>
      {!list ? <p className="mt-3 text-espresso/55">Carregando…</p> : upcoming.length === 0 ? <p className="mt-3 text-espresso/65">Nenhum horário marcado.</p> : (
        <ul className="mt-4 space-y-3">
          {upcoming.map((a) => (
            <li key={a.id} className="panel p-5">
              <span className={`chip ${STATUS_STYLE[a.status]}`}>{STATUS_LABEL[a.status]}</span>
              <p className="mt-3 font-display text-[1.8rem] leading-none">{a.service_name}</p>
              <p className="mt-2 text-[1.05rem]">{longDate(dateSP(a.starts_at))}, às <strong>{timeSP(a.starts_at)}</strong></p>
              <p className="text-[0.9rem] text-espresso/60">{[lengthLabel(a.hair_length), a.price != null ? money(a.price) : a.price_note].filter(Boolean).join(' · ')}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <a href={contactLink(settings.contact, `Olá! Sobre meu horário de ${a.service_name} no dia ${shortDate(dateSP(a.starts_at))} às ${timeSP(a.starts_at)}…`)} target="_blank" rel="noopener noreferrer" className="btn border border-espresso/25 !px-3 text-[0.75rem]"><Whats /> Mudar</a>
                <button onClick={() => cancel(a)} className="btn border border-erro/40 !px-3 text-[0.75rem] text-erro">Cancelar</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {hist.length > 0 && (
        <>
          <h2 className="mt-10 text-[1.8rem]">O que já fiz</h2>
          <ul className="mt-3 divide-y divide-espresso/10 border-y border-espresso/10">
            {hist.map((h) => (
              <li key={h.id} className="py-3">
                <p><strong className="font-display text-xl font-normal">{h.service_name}</strong> <span className="text-[0.9rem] text-espresso/55">· {shortDate(h.performed_on)}</span></p>
                {h.client_notes && <p className="mt-1 text-[0.95rem] italic text-espresso/75">{h.client_notes}</p>}
              </li>
            ))}
          </ul>
        </>
      )}

      {past.length > 0 && (
        <details className="mt-8">
          <summary className="min-h-11 cursor-pointer py-2 text-[0.95rem] underline">Pedidos anteriores ({past.length})</summary>
          <ul className="mt-2 divide-y divide-espresso/10">
            {past.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 py-3 text-[0.9rem]">
                <span>{a.service_name} · {shortDate(dateSP(a.starts_at))}</span>
                <span className={`chip !text-[0.6rem] ${STATUS_STYLE[a.status]}`}>{STATUS_LABEL[a.status]}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="mt-12 space-y-1 border-t border-espresso/15 pt-6 text-[0.9rem]">
        <button onClick={exit} className="block min-h-11 underline">Sair deste celular</button>
        <button onClick={exportData} className="block min-h-11 underline">Baixar meus dados</button>
        <button onClick={del} className="block min-h-11 text-erro underline">Excluir meus dados</button>
      </div>
    </>
  )
}

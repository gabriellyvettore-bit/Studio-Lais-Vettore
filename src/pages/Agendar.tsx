import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useSiteData } from '../context/SiteData'
import { supabase, isConfigured, friendlyError } from '../lib/supabase'
import { maskPhone, onlyDigits } from '../lib/format'
import { monthTitle, HAIR_LENGTHS, durationLabel, effectivePrice, lengthLabel, longDate, money, priceFor, priceSummary, promoActive, timeSP, todaySP } from '../lib/format'
import { contactLink } from '../lib/whatsapp'
import type { HairLength, Service } from '../lib/types'
import { getGuest, saveGuest, clearGuest, maskBirth, parseBirth } from '../lib/guest'
import { ArrowLeft, Arrow, Check, Whats } from '../components/Icons'

const DRAFT = 'slv:draft'
interface Draft { serviceId?: string; length?: HairLength | null; date?: string; slot?: string; note?: string }

export function NotReady() {
  const { settings } = useSiteData()
  return (
    <section className="mx-auto flex min-h-[80vh] max-w-3xl flex-col justify-center px-5 pt-28 sm:px-8">
      <p className="kicker">Agendamento online</p>
      <h1 className="mt-5 text-6xl leading-none">Quase pronto <em className="text-cacau">por aqui.</em></h1>
      <p className="mt-6 max-w-lg leading-relaxed text-espresso/70">Nossa agenda online está sendo finalizada. Enquanto isso, a Laís agenda seu horário pessoalmente pelo WhatsApp.</p>
      <a href={contactLink(settings.contact, 'Olá! Gostaria de agendar um horário.')} target="_blank" rel="noopener noreferrer" className="btn-dark mt-10 self-start"><Whats /> Agendar pelo WhatsApp</a>
    </section>
  )
}

export default function Agendar() {
  const { services, settings } = useSiteData()
  const [params] = useSearchParams()
  const bookable = services.filter((s) => s.bookable_online)

  const [draft, setDraft] = useState<Draft>(() => {
    const saved = sessionStorage.getItem(DRAFT)
    const d: Draft = saved ? JSON.parse(saved) : {}
    const q = params.get('servico')
    return q && q !== d.serviceId ? { serviceId: q } : d
  })
  const [done, setDone] = useState<string | false>(false)
  useEffect(() => { sessionStorage.setItem(DRAFT, JSON.stringify(draft)) }, [draft])
  // a cada passo (e no final) volta para o topo da tela
  const stepKey = `${draft.serviceId}|${draft.length}|${draft.slot}|${done}`
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }) }, [stepKey])

  const service = bookable.find((s) => s.id === draft.serviceId)
  const needsLength = service?.price_mode === 'por_comprimento'
  const step = !service ? 1 : needsLength && !draft.length ? 2 : !draft.slot ? 3 : 4
  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }))
  const back = () => {
    if (step === 4) set({ slot: undefined })
    else if (step === 3) set(needsLength ? { length: undefined, date: undefined } : { serviceId: undefined, date: undefined })
    else if (step === 2) set({ serviceId: undefined })
  }

  if (!isConfigured) return <NotReady />
  if (done) return <Success name={done.trim()} onAgain={() => { setDone(false); setDraft({}) }} />

  const steps = ['Serviço', 'Cabelo', 'Dia e hora', 'Seus dados']

  return (
    <section className="mx-auto max-w-[1100px] px-5 pb-16 pt-24 sm:px-8 sm:pt-36">
      <div className="flex min-h-12 items-center justify-between gap-4">
        {step > 1
          ? <button onClick={back} className="-ml-2 flex min-h-12 items-center gap-2 px-2 text-[1rem] font-medium"><ArrowLeft width={22} height={22} /> Voltar</button>
          : <p className="kicker">Agendar horário</p>}
        <p className="text-[0.9rem] text-espresso/60">Passo {needsLength || step === 1 ? step : step - 1} de {needsLength || step === 1 ? 4 : 3}</p>
      </div>
      <ol className="mt-2 grid grid-cols-4 gap-2 sm:mt-6" aria-label="Etapas">
        {steps.map((s, i) => (
          <li key={s} className={`truncate border-t-2 pt-3 text-[0.66rem] font-semibold uppercase tracking-[0.16em] transition ${i + 1 <= step ? 'border-espresso text-espresso' : 'border-espresso/15 text-espresso/35'} ${i === 1 && service && !needsLength ? 'opacity-40' : ''}`}>
            <span className="hidden sm:inline">{String(i + 1).padStart(2, '0')} · </span><span className={i + 1 === step ? '' : 'sr-only sm:not-sr-only'}>{s}</span>
          </li>
        ))}
      </ol>

      <div className="mt-8 [animation:fade_.5s_ease] sm:mt-12" key={step}>
        {step === 1 && (
          <>
            <h1 className="text-[clamp(2.3rem,5vw,3.8rem)] leading-none">O que você <em className="text-cacau">quer fazer?</em></h1>
            <ul className="mt-6 grid gap-3 sm:mt-10 sm:grid-cols-2">
              {bookable.map((s) => <ServiceCard key={s.id} s={s} onPick={() => set({ serviceId: s.id, length: s.price_mode === 'unico' ? null : undefined, slot: undefined, date: undefined })} />)}
            </ul>
            <a href={contactLink(settings.contact, 'Olá! Gostaria de agendar um procedimento que não está no site.')} target="_blank" rel="noopener noreferrer"
              className="mt-3 flex items-center justify-between gap-4 border border-dashed border-espresso/30 p-6 transition hover:border-espresso">
              <span><span className="block font-display text-2xl">Outros procedimentos</span><span className="mt-1 block text-sm text-espresso/60">Mega hair, maquiagem, corte sem escova… combine com a Laís.</span></span>
              <Whats width={24} height={24} className="shrink-0 text-bronze" />
            </a>
          </>
        )}

        {step === 2 && service && (
          <>
            <h1 className="text-[clamp(2.3rem,5vw,3.8rem)] leading-none">Qual o tamanho do <em className="text-cacau">seu cabelo?</em></h1>
            <p className="mt-3 text-espresso/65">{service.name} — o valor muda conforme o tamanho.</p>
            <ul className="mt-6 grid grid-cols-2 gap-3 sm:mt-10 lg:grid-cols-4">
              {HAIR_LENGTHS.map((l, i) => {
                const p = priceFor(service, l.value)
                const off = p?.unavailable
                return (
                  <li key={l.value}>
                    <button disabled={off} onClick={() => set({ length: l.value, slot: undefined, date: undefined })}
                      className="group flex h-full w-full flex-col items-center border border-espresso/15 bg-white/70 p-4 text-center transition active:bg-areia hover:border-espresso disabled:cursor-not-allowed disabled:opacity-45">
                      <LengthFigure level={i} />
                      <span className="mt-3 font-display text-[1.8rem] leading-none">{l.label}</span>
                      <span className="mt-1 text-[0.85rem] leading-snug text-espresso/60">{l.hint}</span>
                      <span className="mt-3 w-full border-t border-espresso/10 pt-2 text-[0.9rem]">
                        {off ? 'Só pelo WhatsApp' : p?.price == null ? <span className="text-espresso/65">Valor no salão</span>
                          : <>{promoActive(p) && <s className="mr-2 text-espresso/40">{money(p.price)}</s>}<strong className="font-display text-2xl font-normal">{money(effectivePrice(p))}</strong></>}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            {priceFor(service, 'extra_longo')?.unavailable && (
              <p className="mt-6 text-sm text-espresso/60">Cabelo extra longo? <a className="underline" href={contactLink(settings.contact, `Olá! Gostaria de agendar ${service.name} para cabelo extra longo.`)} target="_blank" rel="noopener noreferrer">Fale com a gente pelo WhatsApp</a>.</p>
            )}
          </>
        )}

        {step === 3 && service && (
          <SlotPicker service={service} length={draft.length ?? null} date={draft.date}
            onDate={(date) => set({ date })} onSlot={(slot) => set({ slot })} />
        )}

        {step === 4 && service && draft.slot && (
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <h1 className="text-[clamp(2.3rem,5vw,3.6rem)] leading-none">Quase <em className="text-cacau">pronto!</em></h1>
              <Summary service={service} length={draft.length ?? null} slot={draft.slot} />
            </div>
            <div className="lg:col-span-6 lg:col-start-7">
              <GuestForm draft={draft} service={service} onNote={(note) => set({ note })}
                onDone={(name) => { sessionStorage.removeItem(DRAFT); setDone(name || ' ') }} onTaken={() => set({ slot: undefined })} />
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function ServiceCard({ s, onPick }: { s: Service; onPick: () => void }) {
  const p = priceSummary(s)
  return (
    <li>
      <button onClick={onPick} className="group flex h-full w-full flex-col justify-between border border-espresso/15 bg-white/60 p-6 text-left transition hover:border-espresso hover:bg-white">
        <span>
          <span className="flex items-start justify-between gap-4">
            <span className="font-display text-[2rem] leading-none">{s.name}</span>
            {p.promo && <span className="chip shrink-0 border-bronze text-bronze">Promoção</span>}
          </span>
          {s.description && <span className="mt-3 block text-sm leading-relaxed text-espresso/60">{s.description}</span>}
        </span>
        <span className="mt-6 flex items-end justify-between border-t border-espresso/10 pt-4">
          <span className="text-[0.72rem] uppercase tracking-[0.14em] text-espresso/50">{durationLabel(s.duration_min)}{s.allowed_weekdays.length < 5 ? ' · dias específicos' : ''}</span>
          <span className="flex items-center gap-3 font-display text-2xl">{p.label}<Arrow className="text-bronze transition group-hover:translate-x-1" /></span>
        </span>
      </button>
    </li>
  )
}

/** Ilustração simples do comprimento do cabelo */
function LengthFigure({ level }: { level: number }) {
  const ends = [34, 44, 58, 72][level]
  return (
    <svg viewBox="0 0 60 80" className="h-20 w-16 text-espresso" aria-hidden>
      <circle cx="30" cy="22" r="11" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M18 40c0 0 4-6 12-6s12 6 12 6v40" fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="1.2" />
      <path d={`M19 22c0-9 5-14 11-14s11 5 11 14v${ends - 22}h-4V24M19 22v${ends - 22}h4V24`} fill="currentColor" fillOpacity=".75" />
      <line x1="4" x2="56" y1={ends} y2={ends} stroke="var(--color-bronze)" strokeDasharray="2 3" />
    </svg>
  )
}

function SlotPicker({ service, length, date, onDate, onSlot }:
  { service: Service; length: HairLength | null; date?: string; onDate: (d: string) => void; onSlot: (iso: string) => void }) {
  const { settings } = useSiteData()
  const today = todaySP()
  const [month, setMonth] = useState(() => startOfMonth(new Date(`${date ?? today}T12:00:00`)))
  const [days, setDays] = useState<Set<string> | null>(null)
  const [slots, setSlots] = useState<string[] | null>(null)
  const [err, setErr] = useState('')
  const maxMonth = startOfMonth(addMonths(new Date(), Math.ceil(settings.booking.horizon_days / 30)))

  useEffect(() => {
    let alive = true
    setDays(null); setErr('')
    const from = format(month, 'yyyy-MM-dd') < today ? today : format(month, 'yyyy-MM-dd')
    supabase!.rpc('get_available_days', { p_service: service.id, p_length: length, p_from: from, p_days: 42 })
      .then(({ data, error }) => {
        if (!alive) return
        if (error) { setErr(friendlyError(error)); setDays(new Set()); return }
        setDays(new Set((data as { day: string }[]).map((d) => d.day)))
      })
    return () => { alive = false }
  }, [month, service.id, length, today])

  useEffect(() => {
    if (!date) { setSlots(null); return }
    let alive = true
    setSlots(null)
    supabase!.rpc('get_available_slots', { p_date: date, p_service: service.id, p_length: length })
      .then(({ data, error }) => {
        if (!alive) return
        if (error) { setErr(friendlyError(error)); setSlots([]); return }
        setSlots((data as { starts_at: string }[]).map((d) => d.starts_at))
      })
    return () => { alive = false }
  }, [date, service.id, length])

  const grid = useMemo(() => eachDayOfInterval({ start: startOfWeek(month), end: endOfWeek(endOfMonth(month)) }), [month])
  const groups = useMemo(() => {
    const g: Record<string, string[]> = { Manhã: [], Tarde: [] }
    for (const s of slots ?? []) g[Number(timeSP(s).slice(0, 2)) < 12 ? 'Manhã' : 'Tarde'].push(s)
    return g
  }, [slots])

  return (
    <div className="grid gap-12 lg:grid-cols-12">
      <div className="lg:col-span-6">
        <h1 className="text-[clamp(2.4rem,5vw,3.6rem)] leading-none">Escolha o <em className="text-cacau">dia.</em></h1>
        <p className="mt-4 text-sm text-espresso/60">{service.name}{length ? ` · ${lengthLabel(length)}` : ''} · mostramos apenas os dias com horário livre.</p>
        <div className="mt-8 flex items-center justify-between">
          <button onClick={() => setMonth((m) => addMonths(m, -1))} disabled={format(month, 'yyyy-MM') <= today.slice(0, 7)} className="p-3 disabled:opacity-25" aria-label="Mês anterior"><ArrowLeft /></button>
          <p className="font-display text-2xl">{monthTitle(month)}</p>
          <button onClick={() => setMonth((m) => addMonths(m, 1))} disabled={month >= maxMonth} className="p-3 disabled:opacity-25" aria-label="Próximo mês"><Arrow /></button>
        </div>
        <div className="mt-4 grid grid-cols-7 text-center text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-espresso/45">
          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <span key={i} className="py-2">{d}</span>)}
        </div>
        <div className={`grid grid-cols-7 gap-1 ${days === null ? 'animate-pulse' : ''}`}>
          {grid.map((d) => {
            const ymd = format(d, 'yyyy-MM-dd')
            const ok = days?.has(ymd)
            const sel = ymd === date
            return (
              <button key={ymd} disabled={!ok || !isSameMonth(d, month)} onClick={() => { onDate(ymd); if (window.innerWidth < 1024) requestAnimationFrame(() => document.getElementById('horarios')?.scrollIntoView({ behavior: 'smooth', block: 'start' })) }}
                className={`relative aspect-square text-[0.95rem] transition ${!isSameMonth(d, month) ? 'invisible' : ''} ${sel ? 'bg-espresso text-marfim' : ok ? 'bg-white/70 hover:bg-areia' : 'text-espresso/25'}`}
                aria-label={`${format(d, "d 'de' MMMM", { locale: ptBR })}${ok ? ', disponível' : ', indisponível'}`} aria-pressed={sel}>
                {format(d, 'd')}
                {ok && !sel && <span className="absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-bronze" />}
              </button>
            )
          })}
        </div>
        {days && days.size === 0 && !err && <p className="mt-6 text-sm text-espresso/60">Sem horários livres neste mês. Tente o próximo ou <a className="underline" href={contactLink(settings.contact)} target="_blank" rel="noopener noreferrer">fale com a gente</a>.</p>}
        {err && <p role="alert" className="mt-6 text-sm text-erro">{err}</p>}
      </div>

      <div className="lg:col-span-5 lg:col-start-8">
        <h2 id="horarios" className="scroll-mt-24 text-[clamp(2rem,4vw,3rem)] leading-none">E o <em className="text-cacau">horário.</em></h2>
        {!date ? <p className="mt-6 text-espresso/50">Selecione um dia no calendário.</p>
          : slots === null ? <p className="mt-6 animate-pulse text-espresso/50">Buscando horários…</p>
          : slots.length === 0 ? <p className="mt-6 text-espresso/60">Esse dia acabou de lotar. Escolha outro.</p>
          : (
            <div className="mt-6 space-y-8">
              <p className="text-sm text-espresso/60">{longDate(date)}</p>
              {Object.entries(groups).filter(([, v]) => v.length).map(([g, v]) => (
                <div key={g}>
                  <p className="label">{g}</p>
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {v.map((s) => <button key={s} onClick={() => onSlot(s)} className="border border-espresso/20 bg-white/70 py-3 text-[0.95rem] transition hover:border-espresso hover:bg-espresso hover:text-marfim">{timeSP(s)}</button>)}
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  )
}

function Summary({ service, length, slot }: { service: Service; length: HairLength | null; slot: string }) {
  const p = priceFor(service, length)
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(slot))
  const dur = p?.duration_min ?? service.duration_min
  const price = p ? effectivePrice(p, date) : null
  return (
    <dl className="mt-8 divide-y divide-espresso/10 border-y border-espresso/15">
      {[
        ['Serviço', service.name],
        ...(length ? [['Comprimento', lengthLabel(length)]] : []),
        ['Data', <span>{longDate(date)}</span>],
        ['Horário', `${timeSP(slot)} · duração aprox. ${durationLabel(dur)}`],
        ['Valor', price != null ? <span className="font-display text-2xl">{money(price)}</span> : <span className="text-espresso/60">Confirmado no salão</span>],
      ].map(([k, v], i) => (
        <div key={i} className="flex items-baseline justify-between gap-6 py-4"><dt className="label !mb-0">{k}</dt><dd className="text-right">{v}</dd></div>
      ))}
    </dl>
  )
}

function GuestForm({ draft, service, onNote, onDone, onTaken }:
  { draft: Draft; service: Service; onNote: (n: string) => void; onDone: (firstName: string) => void; onTaken: () => void }) {
  const [guest, setGuest] = useState(getGuest())
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [birth, setBirth] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function go(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    let birthIso: string | null = null
    if (!guest) {
      if (name.trim().split(/\s+/).length < 2) return setErr('Escreva seu nome e sobrenome.')
      if (![10, 11].includes(onlyDigits(phone).length)) return setErr('Confira o celular com DDD. Ex.: (11) 91234-5678')
      birthIso = parseBirth(birth)
      if (!birthIso) return setErr('Confira a data de nascimento. Ex.: 25/03/1970')
      if (!consent) return setErr('Marque a caixinha de autorização para continuar.')
    }
    setBusy(true)
    const { data, error } = await supabase!.rpc('book_as_guest', {
      p_name: guest ? null : name.trim(), p_phone: guest ? null : phone, p_birth: birthIso,
      p_service: service.id, p_length: draft.length ?? null, p_starts_at: draft.slot,
      p_note: draft.note ?? null, p_consent: guest ? false : consent, p_token: guest?.token ?? null,
    })
    setBusy(false)
    if (error) {
      setErr(friendlyError(error))
      if (error.message.includes('slot_unavailable')) setTimeout(onTaken, 2500)
      return
    }
    const r = data as { token: string | null; first_name: string }
    if (r.token) saveGuest({ token: r.token, first_name: r.first_name, full_name: guest?.full_name ?? name.trim(), phone: guest?.phone ?? phone })
    onDone(r.first_name)
  }

  return (
    <form onSubmit={go} className="panel space-y-5 p-5 sm:p-8" noValidate>
      {guest ? (
        <div className="flex items-center justify-between gap-3 bg-linho p-4">
          <p className="text-[1.05rem]">Agendando como <strong className="font-semibold">{guest.full_name ?? guest.first_name}</strong></p>
          <button type="button" onClick={() => { clearGuest(); setGuest(null) }} className="min-h-11 shrink-0 text-[0.85rem] underline">Não sou eu</button>
        </div>
      ) : (
        <>
          <h2 className="text-[1.8rem] leading-tight">Seus dados</h2>
          <p className="-mt-3 text-[0.95rem] text-espresso/65">Sem cadastro e sem senha. Só para a Laís confirmar com você.</p>
          <div><label className="label" htmlFor="g-name">Nome e sobrenome</label>
            <input id="g-name" className="field-box !py-3 !text-[1.05rem]" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></div>
          <div><label className="label" htmlFor="g-phone">Celular (WhatsApp)</label>
            <input id="g-phone" className="field-box !py-3 !text-[1.05rem]" inputMode="tel" autoComplete="tel" placeholder="(11) 91234-5678" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} /></div>
          <div><label className="label" htmlFor="g-birth">Data de nascimento</label>
            <input id="g-birth" className="field-box !py-3 !text-[1.05rem]" inputMode="numeric" placeholder="dia/mês/ano" value={birth} onChange={(e) => setBirth(maskBirth(e.target.value))} />
            <p className="mt-1 text-[0.8rem] text-espresso/55">Serve para você ver seus horários depois, em qualquer celular.</p></div>
        </>
      )}
      <div><label className="label" htmlFor="note">Recado para a Laís (se quiser)</label>
        <textarea id="note" rows={2} maxLength={500} className="field-box !text-[1rem]" placeholder="Ex.: tenho alergia a…" value={draft.note ?? ''} onChange={(e) => onNote(e.target.value)} /></div>
      {!guest && (
        <label className="flex cursor-pointer gap-3 text-[0.95rem] leading-relaxed text-espresso/80">
          <input type="checkbox" className="mt-1 h-6 w-6 shrink-0 accent-[#2b1f19]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>Autorizo o studio a guardar meus dados para os atendimentos (<Link to="/privacidade" target="_blank" className="underline">privacidade</Link>).</span>
        </label>
      )}
      {err && <p role="alert" className="bg-erro/10 p-3 text-[0.95rem] text-erro">{err}</p>}
      <button disabled={busy} className="btn-dark w-full text-[0.95rem]">{busy ? 'Enviando…' : <><Check /> Confirmar agendamento</>}</button>
      <p className="text-center text-[0.85rem] text-espresso/55">A Laís confirma seu horário pelo WhatsApp.</p>
    </form>
  )
}

function Success({ name, onAgain }: { name: string; onAgain: () => void }) {
  const { settings } = useSiteData()
  return (
    <section className="mx-auto flex min-h-[85vh] max-w-3xl flex-col justify-center px-5 pb-10 pt-24 sm:px-8 [animation:fade_.6s_ease]">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-espresso text-marfim"><Check width={30} height={30} /></span>
      <h1 className="mt-6 text-[clamp(2.6rem,7vw,5rem)] leading-[0.95]">Pedido enviado{name ? `, ${name}` : ''}!</h1>
      <p className="mt-5 max-w-lg text-[1.1rem] leading-relaxed text-espresso/75">Seu horário está reservado. A Laís vai confirmar com você pelo WhatsApp.</p>
      <div className="mt-8 grid gap-3 sm:flex">
        <Link to="/meus-horarios" className="btn-dark">Ver meus horários</Link>
        <a href={contactLink(settings.contact, 'Olá! Acabei de fazer um agendamento pelo site.')} target="_blank" rel="noopener noreferrer" className="btn-line"><Whats /> Falar com o studio</a>
        <button onClick={onAgain} className="btn-ghost min-h-12 justify-center">Agendar outro serviço</button>
      </div>
    </section>
  )
}

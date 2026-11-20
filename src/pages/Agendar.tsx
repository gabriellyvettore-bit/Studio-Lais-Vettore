import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useSiteData } from '../context/SiteData'
import { rememberReturn, useAuth } from '../context/Auth'
import { supabase, isConfigured, friendlyError } from '../lib/supabase'
import { monthTitle, HAIR_LENGTHS, durationLabel, effectivePrice, lengthLabel, longDate, money, priceFor, priceSummary, promoActive, timeSP, todaySP } from '../lib/format'
import { contactLink } from '../lib/whatsapp'
import type { HairLength, Service } from '../lib/types'
import { LoginBox, ProfileForm } from '../components/AuthForms'
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
  const { session, profile, ready } = useAuth()
  const [params] = useSearchParams()
  const bookable = services.filter((s) => s.bookable_online)

  const [draft, setDraft] = useState<Draft>(() => {
    const saved = sessionStorage.getItem(DRAFT)
    const d: Draft = saved ? JSON.parse(saved) : {}
    const q = params.get('servico')
    return q && q !== d.serviceId ? { serviceId: q } : d
  })
  const [done, setDone] = useState(false)
  useEffect(() => { sessionStorage.setItem(DRAFT, JSON.stringify(draft)) }, [draft])

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
  if (done) return <Success onAgain={() => { setDone(false); setDraft({}) }} />

  const steps = ['Serviço', 'Comprimento', 'Data e horário', 'Confirmar']

  return (
    <section className="mx-auto max-w-[1100px] px-5 pb-28 pt-28 sm:px-8 sm:pt-36">
      <div className="flex items-center justify-between gap-4">
        <p className="kicker">Agendar horário</p>
        {step > 1 && <button onClick={back} className="btn-ghost py-3 !text-[0.7rem]"><ArrowLeft /> Voltar</button>}
      </div>
      <p className="mt-4 text-xs text-espresso/60 sm:hidden">Etapa {step} de 4</p>
      <ol className="mt-3 grid grid-cols-4 gap-2 sm:mt-6" aria-label="Etapas">
        {steps.map((s, i) => (
          <li key={s} className={`truncate border-t-2 pt-3 text-[0.66rem] font-semibold uppercase tracking-[0.16em] transition ${i + 1 <= step ? 'border-espresso text-espresso' : 'border-espresso/15 text-espresso/35'} ${i === 1 && service && !needsLength ? 'opacity-40' : ''}`}>
            <span className="hidden sm:inline">{String(i + 1).padStart(2, '0')} · </span><span className={i + 1 === step ? '' : 'sr-only sm:not-sr-only'}>{s}</span>
          </li>
        ))}
      </ol>

      <div className="mt-12 [animation:fade_.5s_ease]" key={step}>
        {step === 1 && (
          <>
            <h1 className="text-[clamp(2.4rem,5vw,3.8rem)] leading-none">Qual serviço você <em className="text-cacau">deseja?</em></h1>
            <ul className="mt-10 grid gap-3 sm:grid-cols-2">
              {bookable.map((s) => <ServiceCard key={s.id} s={s} onPick={() => set({ serviceId: s.id, length: s.price_mode === 'unico' ? null : undefined, slot: undefined, date: undefined })} />)}
            </ul>
            <a href={contactLink(settings.contact, 'Olá! Gostaria de agendar um procedimento que não está no site.')} target="_blank" rel="noopener noreferrer"
              className="mt-3 flex items-center justify-between gap-4 border border-dashed border-espresso/30 p-6 transition hover:border-espresso">
              <span><span className="block font-display text-2xl">Outros procedimentos</span><span className="mt-1 block text-sm text-espresso/60">Mega hair, maquiagem, dia da noiva, corte sem escova… combine com a Laís.</span></span>
              <Whats width={24} height={24} className="shrink-0 text-bronze" />
            </a>
          </>
        )}

        {step === 2 && service && (
          <>
            <h1 className="text-[clamp(2.4rem,5vw,3.8rem)] leading-none">Qual o comprimento do <em className="text-cacau">seu cabelo?</em></h1>
            <p className="mt-4 text-espresso/60">{service.name} — o valor varia conforme o tamanho.</p>
            <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {HAIR_LENGTHS.map((l, i) => {
                const p = priceFor(service, l.value)
                const off = p?.unavailable
                return (
                  <li key={l.value}>
                    <button disabled={off} onClick={() => set({ length: l.value, slot: undefined, date: undefined })}
                      className="group flex h-full w-full flex-col border border-espresso/15 bg-white/60 p-5 text-left transition hover:border-espresso disabled:cursor-not-allowed disabled:opacity-45">
                      <LengthFigure level={i} />
                      <span className="mt-5 font-display text-3xl">{l.label}</span>
                      <span className="mt-1 text-sm text-espresso/55">{l.hint}</span>
                      <span className="mt-5 border-t border-espresso/10 pt-3 text-sm">
                        {off ? 'Sob consulta pelo WhatsApp' : p?.price == null ? <span className="text-espresso/60">Valor confirmado no salão</span>
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
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <h1 className="text-[clamp(2.4rem,5vw,3.6rem)] leading-none">Confira e <em className="text-cacau">confirme.</em></h1>
              <Summary service={service} length={draft.length ?? null} slot={draft.slot} />
              <label className="label mt-8" htmlFor="note">Observação para a Laís (opcional)</label>
              <textarea id="note" rows={3} maxLength={500} className="field resize-none" placeholder="Ex.: quero manter o comprimento, tenho alergia a…" value={draft.note ?? ''} onChange={(e) => set({ note: e.target.value })} />
            </div>
            <div className="lg:col-span-6 lg:col-start-7">
              {!ready ? <p className="text-espresso/50">Carregando…</p>
                : !session ? (
                  <div onClickCapture={() => rememberReturn('/agendar')}>
                    <LoginBox title="Entre para finalizar" subtitle="Seu horário fica guardado enquanto você entra." />
                  </div>
                ) : !profile ? (
                  <div className="panel p-6 sm:p-8">
                    <h2 className="text-3xl">Só falta seu cadastro</h2>
                    <p className="mt-2 mb-8 text-sm text-espresso/60">Usamos para confirmar o horário com você.</p>
                    <ProfileForm submitLabel="Salvar e continuar" onDone={() => undefined} />
                  </div>
                ) : <Confirm draft={draft} service={service} onDone={() => { sessionStorage.removeItem(DRAFT); setDone(true) }} onTaken={() => set({ slot: undefined })} />}
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

function Confirm({ draft, service, onDone, onTaken }: { draft: Draft; service: Service; onDone: () => void; onTaken: () => void }) {
  const { profile } = useAuth()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function go() {
    setBusy(true); setErr('')
    const { error } = await supabase!.rpc('book_appointment', {
      p_service: service.id, p_length: draft.length ?? null, p_starts_at: draft.slot, p_note: draft.note ?? null,
    })
    setBusy(false)
    if (error) {
      setErr(friendlyError(error))
      if (error.message.includes('slot_unavailable')) setTimeout(onTaken, 2200)
      return
    }
    onDone()
  }
  return (
    <div className="panel p-6 sm:p-8">
      <p className="kicker">Tudo certo, {profile?.full_name.split(' ')[0]}</p>
      <p className="mt-4 font-display text-3xl leading-tight">Ao solicitar, seu horário fica reservado e a Laís confirma em seguida.</p>
      <ul className="mt-6 space-y-2 text-sm text-espresso/65">
        <li className="flex gap-2"><Check className="mt-0.5 shrink-0 text-bronze" /> Você acompanha o status em “Minha conta”.</li>
        <li className="flex gap-2"><Check className="mt-0.5 shrink-0 text-bronze" /> Precisa desmarcar? Cancele pela sua conta.</li>
      </ul>
      {err && <p role="alert" className="mt-6 text-sm text-erro">{err}</p>}
      <button onClick={go} disabled={busy} className="btn-dark mt-8 w-full">{busy ? 'Enviando…' : 'Solicitar agendamento'}</button>
    </div>
  )
}

function Success({ onAgain }: { onAgain: () => void }) {
  const { settings } = useSiteData()
  return (
    <section className="mx-auto flex min-h-[85vh] max-w-3xl flex-col justify-center px-5 pt-28 sm:px-8 [animation:fade_.6s_ease]">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-espresso text-marfim"><Check width={26} height={26} /></span>
      <h1 className="mt-8 text-[clamp(3rem,7vw,5rem)] leading-[0.95]">Pedido enviado. <em className="text-cacau">Até breve!</em></h1>
      <p className="mt-6 max-w-lg leading-relaxed text-espresso/70">Seu horário está reservado e aguardando a confirmação da Laís. Você pode acompanhar tudo na sua conta.</p>
      <div className="mt-10 flex flex-wrap gap-4">
        <Link to="/conta" className="btn-dark">Ver meus agendamentos</Link>
        <a href={contactLink(settings.contact, 'Olá! Acabei de solicitar um agendamento pelo site.')} target="_blank" rel="noopener noreferrer" className="btn-line"><Whats /> Falar com o studio</a>
        <button onClick={onAgain} className="btn-ghost">Agendar outro serviço</button>
      </div>
    </section>
  )
}

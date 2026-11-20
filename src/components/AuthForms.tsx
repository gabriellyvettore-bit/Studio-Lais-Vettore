import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, friendlyError } from '../lib/supabase'
import { useAuth } from '../context/Auth'
import { maskPhone } from '../lib/format'
import { Google, Lock } from './Icons'

const redirectTo = () => window.location.origin + import.meta.env.BASE_URL

export function LoginBox({ title = 'Entre para continuar', subtitle }: { title?: string; subtitle?: string }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function google() {
    setErr(''); setBusy(true)
    const { error } = await supabase!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } })
    if (error) { setErr(friendlyError(error)); setBusy(false) }
  }
  async function magic(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return setErr('Informe um e-mail válido.')
    setBusy(true)
    const { error } = await supabase!.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectTo(), shouldCreateUser: true } })
    setBusy(false)
    if (error) setErr(
      /rate|seconds/i.test(error.message) ? 'Aguarde alguns segundos antes de pedir outro link.'
      : (error.status ?? 0) >= 500 || /sending|email/i.test(error.message) ? 'Não conseguimos enviar o e-mail agora. Entre com o Google ou fale com a gente pelo WhatsApp.'
      : friendlyError(error))
    else setSent(true)
  }

  if (sent) return (
    <div className="panel p-8">
      <p className="kicker">Confira seu e-mail</p>
      <p className="mt-4 font-display text-3xl leading-tight">Enviamos um link de acesso para <em>{email}</em>.</p>
      <p className="mt-4 text-sm text-espresso/65">Abra o e-mail neste mesmo aparelho e toque no link. Não chegou? Veja a caixa de spam ou <button className="underline" onClick={() => setSent(false)}>tente de novo</button>.</p>
    </div>
  )

  return (
    <div className="panel p-6 sm:p-8">
      <h2 className="text-3xl">{title}</h2>
      {subtitle && <p className="mt-2 text-sm text-espresso/60">{subtitle}</p>}
      <button onClick={google} disabled={busy} className="btn mt-7 w-full border border-espresso/20 bg-white normal-case tracking-normal text-[0.95rem] font-medium text-espresso hover:border-espresso">
        <Google /> Continuar com Google
      </button>
      <div className="my-6 flex items-center gap-4 text-[0.7rem] uppercase tracking-[0.2em] text-espresso/40"><span className="rule" />ou<span className="rule" /></div>
      <form onSubmit={magic} noValidate>
        <label className="label" htmlFor="email">Seu e-mail</label>
        <input id="email" type="email" autoComplete="email" inputMode="email" className="field" placeholder="voce@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button disabled={busy} className="btn-dark mt-6 w-full">{busy ? 'Enviando…' : 'Receber link de acesso'}</button>
      </form>
      {err && <p role="alert" className="mt-4 text-sm text-erro">{err}</p>}
      <p className="mt-6 flex gap-2 text-xs leading-relaxed text-espresso/50"><Lock className="shrink-0" width={14} height={14} /> Sem senha para decorar. Seus dados são protegidos e usados apenas pelo studio. <Link to="/privacidade" className="underline">Privacidade</Link></p>
    </div>
  )
}

export function ProfileForm({ onDone, submitLabel = 'Salvar cadastro' }: { onDone?: () => void; submitLabel?: string }) {
  const { profile, session, refresh } = useAuth()
  const meta = session?.user.user_metadata ?? {}
  const [name, setName] = useState(profile?.full_name ?? meta.full_name ?? meta.name ?? '')
  const [phone, setPhone] = useState(maskPhone(profile?.phone ?? ''))
  const [birth, setBirth] = useState(profile?.birth_date ?? '')
  const [consent, setConsent] = useState(Boolean(profile?.lgpd_consent_at))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setOk(false)
    if (!consent) return setErr('Para continuar, aceite a Política de Privacidade.')
    setBusy(true)
    const { error } = await supabase!.rpc('upsert_my_profile', { p_full_name: name, p_phone: phone, p_birth_date: birth || null, p_consent: consent })
    setBusy(false)
    if (error) return setErr(friendlyError(error))
    await refresh(); setOk(true); onDone?.()
  }

  return (
    <form onSubmit={save} className="space-y-6" noValidate>
      <div><label className="label" htmlFor="pf-name">Nome completo</label><input id="pf-name" className="field" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div><label className="label" htmlFor="pf-phone">WhatsApp / telefone</label><input id="pf-phone" className="field" inputMode="tel" autoComplete="tel" placeholder="(11) 90000-0000" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} /></div>
        <div><label className="label" htmlFor="pf-birth">Nascimento (opcional)</label><input id="pf-birth" type="date" className="field" value={birth} onChange={(e) => setBirth(e.target.value)} /></div>
      </div>
      {!profile?.lgpd_consent_at && (
        <label className="flex cursor-pointer gap-3 text-sm leading-relaxed text-espresso/75">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-[#2b1f19]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>Li e aceito a <Link to="/privacidade" target="_blank" className="underline">Política de Privacidade</Link> e autorizo o studio a guardar meus dados e histórico de atendimentos.</span>
        </label>
      )}
      {err && <p role="alert" className="text-sm text-erro">{err}</p>}
      {ok && !onDone && <p className="text-sm text-ok">Dados salvos.</p>}
      <button disabled={busy} className="btn-dark w-full sm:w-auto">{busy ? 'Salvando…' : submitLabel}</button>
    </form>
  )
}

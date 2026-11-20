import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase, isConfigured, friendlyError } from '../lib/supabase'
import { maskBirth, parseBirth, saveGuest } from '../lib/guest'
import { Check } from '../components/Icons'
import { NotReady } from './Agendar'

/** Cliente cadastrada pela Laís confirma o próprio cadastro pelo link do WhatsApp. */
export default function Confirmar() {
  const { token } = useParams()
  const [info, setInfo] = useState<{ first_name: string; has_birth: boolean } | null | undefined>(undefined)
  const [birth, setBirth] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)
  const valid = token && /^[0-9a-f-]{36}$/i.test(token)

  useEffect(() => {
    if (!supabase || !valid) { setInfo(null); return }
    supabase.rpc('invite_info', { p_invite: token }).then(({ data }) => setInfo((data as typeof info) ?? null))
  }, [token, valid])

  async function go(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    const b = parseBirth(birth)
    if (!b) return setErr('Confira a data de nascimento. Ex.: 25/03/1970')
    if (!consent) return setErr('Marque a caixinha de autorização para continuar.')
    setBusy(true)
    const { data, error } = await supabase!.rpc('confirm_invite', { p_invite: token, p_birth: b, p_consent: consent })
    setBusy(false)
    if (error) return setErr(friendlyError(error))
    if (data?.error) return setErr(friendlyError({ message: data.error }))
    saveGuest({ token: data.token, first_name: data.first_name })
    setDone(true)
  }

  if (!isConfigured) return <NotReady />
  return (
    <section className="mx-auto flex min-h-[85vh] max-w-xl flex-col justify-center px-5 pb-10 pt-24 sm:px-8">
      {info === undefined ? <p className="text-espresso/55">Carregando…</p>
        : done ? (
          <>
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-espresso text-marfim"><Check width={30} height={30} /></span>
            <h1 className="mt-6 text-[2.8rem] leading-none">Tudo certo, {info?.first_name}!</h1>
            <p className="mt-4 text-[1.1rem] text-espresso/75">Seu cadastro no studio está confirmado.</p>
            <Link to="/meus-horarios" className="btn-dark mt-8">Ver meus horários</Link>
          </>
        ) : !info ? (
          <>
            <h1 className="text-[2.6rem] leading-none">Link expirado</h1>
            <p className="mt-4 text-[1.05rem] text-espresso/75">Este link já foi usado ou não vale mais. Se precisar, peça um novo para a Laís.</p>
            <Link to="/" className="btn-line mt-8">Ir para o site</Link>
          </>
        ) : (
          <>
            <p className="kicker">Studio Lais Vettore</p>
            <h1 className="mt-3 text-[2.8rem] leading-none">Olá, <em className="text-cacau">{info.first_name}!</em></h1>
            <p className="mt-4 text-[1.1rem] text-espresso/75">A Laís fez seu cadastro no studio. Confirme abaixo para guardar seus horários e o histórico do seu cabelo.</p>
            <form onSubmit={go} className="panel mt-6 space-y-5 p-5 sm:p-8" noValidate>
              <div><label className="label" htmlFor="c-birth">Sua data de nascimento</label>
                <input id="c-birth" className="field-box !py-3 !text-[1.05rem]" inputMode="numeric" placeholder="dia/mês/ano" value={birth} onChange={(e) => setBirth(maskBirth(e.target.value))} /></div>
              <label className="flex cursor-pointer gap-3 text-[0.95rem] leading-relaxed text-espresso/80">
                <input type="checkbox" className="mt-1 h-6 w-6 shrink-0 accent-[#2b1f19]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>Autorizo o studio a guardar meus dados para os atendimentos (<Link to="/privacidade" target="_blank" className="underline">privacidade</Link>).</span>
              </label>
              {err && <p role="alert" className="bg-erro/10 p-3 text-[0.95rem] text-erro">{err}</p>}
              <button disabled={busy} className="btn-dark w-full">{busy ? 'Confirmando…' : <><Check /> Confirmar meu cadastro</>}</button>
            </form>
          </>
        )}
    </section>
  )
}

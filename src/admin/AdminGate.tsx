import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, rememberReturn } from '../context/Auth'
import { supabase, isConfigured, friendlyError } from '../lib/supabase'
import { LoginBox } from '../components/AuthForms'
import { Lock } from '../components/Icons'

/** Protege o painel: precisa ser admin E ter feito verificação em duas etapas.
 *  (O banco também exige isso — esta tela só orienta a Laís.) */
export function AdminGate({ children }: { children: ReactNode }) {
  const { session, who, ready, refresh, signOut } = useAuth()
  useEffect(() => { rememberReturn('/admin') }, [])

  if (!isConfigured) return <Center><p className="kicker">Painel</p><h1 className="mt-4 text-5xl">Banco de dados ainda não configurado.</h1><p className="mt-4 text-espresso/60">Siga o guia em <code>docs/CONFIGURACAO.md</code>.</p></Center>
  if (!ready) return <Center><p className="text-espresso/50">Carregando…</p></Center>
  if (!session) return <Center><p className="kicker">Área do studio</p><h1 className="mb-8 mt-4 text-5xl leading-none">Painel da Laís</h1><LoginBox title="Entrar" subtitle="Acesso restrito à administração." /></Center>
  if (!who?.is_admin_account) return (
    <Center>
      <p className="kicker">Acesso restrito</p>
      <h1 className="mt-4 text-5xl leading-none">Esta área é só para a administração.</h1>
      <div className="mt-8 flex gap-4"><Link to="/conta" className="btn-dark">Ir para minha conta</Link><button onClick={signOut} className="btn-ghost">Sair</button></div>
    </Center>
  )
  if (who.aal !== 'aal2') return <Center><Mfa onDone={refresh} /></Center>
  return <>{children}</>
}

function Center({ children }: { children: ReactNode }) {
  return <section className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-20">{children}</section>
}

function Mfa({ onDone }: { onDone: () => Promise<void> }) {
  const [factorId, setFactorId] = useState<string | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase!.auth.mfa.listFactors()
      if (error) return setErr(friendlyError(error))
      const verified = data.totp.find((f) => f.status === 'verified')
      if (verified) return setFactorId(verified.id)
      for (const f of data.all.filter((f) => f.status === 'unverified')) await supabase!.auth.mfa.unenroll({ factorId: f.id })
      const en = await supabase!.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Studio LV' })
      if (en.error) return setErr(friendlyError(en.error))
      setFactorId(en.data.id); setQr(en.data.totp.qr_code); setSecret(en.data.totp.secret)
    })()
  }, [])

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    if (!factorId) return
    setBusy(true); setErr('')
    const { error } = await supabase!.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\D/g, '') })
    setBusy(false)
    if (error) return setErr('Código inválido ou expirado. Tente o código atual do app.')
    await onDone()
  }

  return (
    <div>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-espresso text-marfim"><Lock /></span>
      <p className="kicker mt-6">Verificação em duas etapas</p>
      {qr ? (
        <>
          <h1 className="mt-3 text-4xl leading-tight">Proteja o painel com seu celular</h1>
          <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-espresso/70">
            <li>Instale o <strong>Google Authenticator</strong> (ou Microsoft Authenticator).</li>
            <li>No app, toque em “+” e escaneie o código abaixo.</li>
            <li>Digite o código de 6 números que aparecer.</li>
          </ol>
          <img src={qr} alt="QR code para o app autenticador" className="mt-6 h-48 w-48 border border-espresso/10 bg-white p-2" />
          {secret && <p className="mt-3 break-all text-xs text-espresso/50">Ou digite a chave: <code>{secret}</code></p>}
        </>
      ) : (
        <h1 className="mt-3 text-4xl leading-tight">Digite o código do seu app autenticador</h1>
      )}
      <form onSubmit={verify} className="mt-8">
        <input inputMode="numeric" autoComplete="one-time-code" maxLength={7} autoFocus className="field text-center font-display text-4xl tracking-[0.4em]" placeholder="000000" value={code} onChange={(e) => setCode(e.target.value)} />
        {err && <p role="alert" className="mt-3 text-sm text-erro">{err}</p>}
        <button disabled={busy || code.replace(/\D/g, '').length !== 6} className="btn-dark mt-6 w-full">{busy ? 'Verificando…' : 'Verificar'}</button>
      </form>
    </div>
  )
}

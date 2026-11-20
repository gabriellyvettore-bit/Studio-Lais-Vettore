import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, rememberReturn } from '../context/Auth'
import { supabase, isConfigured, friendlyError } from '../lib/supabase'
import { Google } from '../components/Icons'
import { Logo } from '../components/Logo'

/** Protege o painel: só a conta administradora do studio (também checado no banco). */
export function AdminGate({ children }: { children: ReactNode }) {
  const { session, who, ready, signOut } = useAuth()
  const [err, setErr] = useState('')
  useEffect(() => { rememberReturn('/admin') }, [])

  async function google() {
    setErr('')
    const { error } = await supabase!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + import.meta.env.BASE_URL } })
    if (error) setErr(friendlyError(error))
  }

  if (!isConfigured) return <Center><h1 className="text-4xl">Banco de dados ainda não configurado.</h1></Center>
  if (!ready) return <Center><p className="text-espresso/50">Carregando…</p></Center>
  if (!session) return (
    <Center>
      <Logo />
      <h1 className="mt-10 text-[2.6rem] leading-none">Área do studio</h1>
      <p className="mt-3 text-espresso/65">Entre com a conta Google do studio.</p>
      <button onClick={google} className="btn mt-8 w-full border border-espresso/25 bg-white text-[1rem] normal-case tracking-normal"><Google /> Entrar com Google</button>
      {err && <p role="alert" className="mt-4 text-erro">{err}</p>}
      <Link to="/" className="mt-8 inline-flex min-h-11 items-center text-[0.9rem] underline">Voltar ao site</Link>
    </Center>
  )
  if (!who) return <Center><p className="text-espresso/50">Carregando…</p></Center>
  if (!who.is_admin_account) return (
    <Center>
      <h1 className="text-[2.4rem] leading-none">Esta área é só para o studio.</h1>
      <p className="mt-3 text-espresso/65">Você entrou com {session.user.email}. Entre com a conta do studio.</p>
      <button onClick={signOut} className="btn-dark mt-8 w-full">Sair e trocar de conta</button>
      <Link to="/" className="mt-4 inline-flex min-h-11 items-center underline">Voltar ao site</Link>
    </Center>
  )
  return <>{children}</>
}

function Center({ children }: { children: ReactNode }) {
  return <section className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-16">{children}</section>
}

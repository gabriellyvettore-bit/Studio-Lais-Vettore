import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, rememberReturn } from '../context/Auth'
import { isConfigured } from '../lib/supabase'
import { LoginBox } from '../components/AuthForms'

/** Protege o painel: só a conta administradora (checado também no banco). */
export function AdminGate({ children }: { children: ReactNode }) {
  const { session, who, ready, signOut } = useAuth()
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
  return <>{children}</>
}

function Center({ children }: { children: ReactNode }) {
  return <section className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-20">{children}</section>
}

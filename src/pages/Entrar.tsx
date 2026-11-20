import { Navigate } from 'react-router-dom'
import { LoginBox } from '../components/AuthForms'
import { useAuth } from '../context/Auth'
import { isConfigured } from '../lib/supabase'
import { Img } from '../components/Img'
import { NotReady } from './Agendar'

export default function Entrar() {
  const { session, ready, who } = useAuth()
  if (!isConfigured) return <NotReady />
  if (ready && session) return <Navigate to={who?.is_admin_account ? '/admin' : '/conta'} replace />
  return (
    <section className="mx-auto grid min-h-[90vh] max-w-[1320px] items-center gap-12 px-5 pb-20 pt-32 sm:px-8 lg:grid-cols-2">
      <div className="hidden aspect-[4/5] max-h-[78vh] overflow-hidden lg:block"><Img src="img/galeria/loiro-iluminado.webp" alt="" /></div>
      <div className="mx-auto w-full max-w-md">
        <p className="kicker">Sua conta</p>
        <h1 className="mt-4 mb-8 text-6xl leading-none">Bem-vinda <em className="text-cacau">de volta.</em></h1>
        <LoginBox title="Entrar ou criar conta" subtitle="Acompanhe seus agendamentos e seu histórico no studio." />
      </div>
    </section>
  )
}

import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes, useNavigate } from 'react-router-dom'
import { AuthProvider, takeReturn, useAuth } from './context/Auth'
import { SiteDataProvider } from './context/SiteData'
import { Layout } from './components/Layout'
import Home from './pages/Home'
import Servicos from './pages/Servicos'
import Galeria from './pages/Galeria'
import Contato from './pages/Contato'
import Privacidade from './pages/Privacidade'
import Agendar from './pages/Agendar'
import MeusHorarios from './pages/MeusHorarios'
import Confirmar from './pages/Confirmar'
import NotFound from './pages/NotFound'

const Admin = lazy(() => import('./admin/AdminRoutes'))

/** Depois do login (Google ou link mágico) volta para onde a cliente estava. */
function ReturnAfterLogin() {
  const { session, ready } = useAuth()
  const nav = useNavigate()
  useEffect(() => {
    if (!ready || !session) return
    const to = takeReturn()
    if (to) nav(to, { replace: true })
  }, [ready, session, nav])
  return null
}

export default function App() {
  return (
    <SiteDataProvider>
      <AuthProvider>
        <ReturnAfterLogin />
        <Routes>
          <Route path="/admin/*" element={<Suspense fallback={<div className="p-10 text-espresso/50">Carregando…</div>}><Admin /></Suspense>} />
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="servicos" element={<Servicos />} />
            <Route path="galeria" element={<Galeria />} />
            <Route path="contato" element={<Contato />} />
            <Route path="privacidade" element={<Privacidade />} />
            <Route path="agendar" element={<Agendar />} />
            <Route path="meus-horarios" element={<MeusHorarios />} />
            <Route path="confirmar/:token" element={<Confirmar />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </SiteDataProvider>
  )
}

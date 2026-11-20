import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { Calendar, Close, Home, Image, Logout, Menu, Scissors, Settings, Text, Users } from '../components/Icons'
import { useAuth } from '../context/Auth'
import { Toaster } from './ui'

const MAIN = [
  { to: '/admin', label: 'Início', icon: Home, end: true },
  { to: '/admin/agenda', label: 'Agenda', icon: Calendar, end: false },
  { to: '/admin/clientes', label: 'Clientes', icon: Users, end: false },
]
const MORE = [
  { to: '/admin/servicos', label: 'Serviços e preços', icon: Scissors, end: false },
  { to: '/admin/horarios', label: 'Horários e equipe', icon: Settings, end: false },
  { to: '/admin/galeria', label: 'Fotos do site', icon: Image, end: false },
  { to: '/admin/conteudo', label: 'Textos e contato', icon: Text, end: false },
]

export function AdminLayout() {
  const { signOut } = useAuth()
  const [more, setMore] = useState(false)
  return (
    <div className="min-h-dvh bg-linho/60 lg:grid lg:grid-cols-[250px_1fr]">
      {/* computador: menu lateral */}
      <aside className="grain sticky top-0 hidden h-dvh flex-col justify-between bg-espresso p-6 lg:flex">
        <div>
          <Link to="/admin" className="block px-3"><Logo light /></Link>
          <nav className="mt-10 flex flex-col gap-1">
            {[...MAIN, ...MORE].map(({ to, label, icon: I, end }) => (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 text-[0.9rem] transition ${isActive ? 'bg-marfim/10 text-marfim' : 'text-marfim/60 hover:text-marfim'}`}>
                <I /> {label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="space-y-1 border-t border-marfim/10 pt-4">
          <Link to="/" className="block px-3 py-2 text-[0.85rem] text-marfim/55 hover:text-marfim">Ver site</Link>
          <button onClick={signOut} className="flex items-center gap-3 px-3 py-2 text-[0.85rem] text-marfim/55 hover:text-marfim"><Logout /> Sair</button>
        </div>
      </aside>

      <main className="min-w-0 px-4 pb-28 pt-6 sm:px-8 lg:px-12 lg:py-12"><Outlet /></main>

      {/* celular: barra de baixo com os atalhos principais */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-espresso/15 bg-marfim pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Painel">
        {MAIN.map(({ to, label, icon: I, end }) => (
          <NavLink key={to} to={to} end={end} onClick={() => setMore(false)}
            className={({ isActive }) => `flex min-h-[64px] flex-col items-center justify-center gap-1 text-[0.75rem] ${isActive && !more ? 'text-espresso font-semibold' : 'text-espresso/55'}`}>
            <I width={24} height={24} /> {label}
          </NavLink>
        ))}
        <button onClick={() => setMore((v) => !v)} className={`flex min-h-[64px] flex-col items-center justify-center gap-1 text-[0.75rem] ${more ? 'font-semibold text-espresso' : 'text-espresso/55'}`}>
          {more ? <Close width={24} height={24} /> : <Menu width={24} height={24} />} Mais
        </button>
      </nav>
      {more && (
        <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] top-0 z-30 flex flex-col justify-end bg-espresso/40 lg:hidden" onClick={() => setMore(false)}>
          <div className="bg-marfim p-3" onClick={(e) => e.stopPropagation()}>
            {MORE.map(({ to, label, icon: I }) => (
              <NavLink key={to} to={to} onClick={() => setMore(false)} className="flex min-h-14 items-center gap-4 border-b border-espresso/10 px-3 text-[1.05rem]"><I width={22} height={22} /> {label}</NavLink>
            ))}
            <div className="flex">
              <Link to="/" className="flex min-h-14 flex-1 items-center px-3 text-[0.95rem] text-espresso/65">Ver site</Link>
              <button onClick={signOut} className="flex min-h-14 items-center gap-2 px-3 text-[0.95rem] text-espresso/65"><Logout /> Sair</button>
            </div>
          </div>
        </div>
      )}
      <Toaster />
    </div>
  )
}

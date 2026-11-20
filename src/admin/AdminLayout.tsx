import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { Calendar, Close, Home, Image, Logout, Menu, Scissors, Settings, Text, Users } from '../components/Icons'
import { useAuth } from '../context/Auth'
import { Toaster } from './ui'

const NAV = [
  { to: '/admin', label: 'Painel', icon: Home, end: true },
  { to: '/admin/agenda', label: 'Agenda', icon: Calendar },
  { to: '/admin/clientes', label: 'Clientes', icon: Users },
  { to: '/admin/servicos', label: 'Serviços e preços', icon: Scissors },
  { to: '/admin/horarios', label: 'Horários', icon: Settings },
  { to: '/admin/galeria', label: 'Galeria', icon: Image },
  { to: '/admin/conteudo', label: 'Textos e contato', icon: Text },
]

export function AdminLayout() {
  const { signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: I, end }) => (
        <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}
          className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 text-[0.85rem] transition ${isActive ? 'bg-marfim/10 text-marfim' : 'text-marfim/60 hover:text-marfim'}`}>
          <I /> {label}
        </NavLink>
      ))}
    </nav>
  )
  return (
    <div className="min-h-dvh bg-linho/60 lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="grain sticky top-0 hidden h-dvh flex-col justify-between bg-espresso p-6 lg:flex">
        <div><Link to="/admin" className="block px-3"><Logo light /></Link><div className="mt-10">{nav}</div></div>
        <div className="space-y-1 border-t border-marfim/10 pt-4">
          <Link to="/" className="block px-3 py-2 text-[0.8rem] text-marfim/55 hover:text-marfim">Ver site</Link>
          <button onClick={signOut} className="flex items-center gap-3 px-3 py-2 text-[0.8rem] text-marfim/55 hover:text-marfim"><Logout /> Sair</button>
        </div>
      </aside>
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between bg-espresso px-5 lg:hidden">
        <Logo light compact />
        <button onClick={() => setOpen(true)} className="p-2 text-marfim" aria-label="Abrir menu"><Menu width={24} height={24} /></button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-espresso p-6 lg:hidden">
          <div className="flex justify-between"><Logo light compact /><button onClick={() => setOpen(false)} className="p-2 text-marfim" aria-label="Fechar"><Close width={24} height={24} /></button></div>
          <div className="mt-10">{nav}</div>
          <div className="mt-auto flex gap-6 border-t border-marfim/10 pt-4 text-sm text-marfim/60"><Link to="/">Ver site</Link><button onClick={signOut}>Sair</button></div>
        </div>
      )}
      <main className="min-w-0 px-4 py-8 sm:px-8 lg:px-12 lg:py-12"><Outlet /></main>
      <Toaster />
    </div>
  )
}

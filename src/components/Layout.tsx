import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Logo } from './Logo'
import { Close, Instagram, Menu, Phone, Pin, Whats } from './Icons'
import { useSiteData } from '../context/SiteData'
import { useAuth } from '../context/Auth'
import { contactLink, hasWhatsapp } from '../lib/whatsapp'
import { isConfigured } from '../lib/supabase'

const NAV = [
  { to: '/servicos', label: 'Serviços' },
  { to: '/galeria', label: 'Galeria' },
  { to: '/noivas', label: 'Noivas' },
  { to: '/contato', label: 'Contato' },
]

export function Layout() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { pathname } = useLocation()
  const { session, who } = useAuth()
  const overHero = pathname === '/' && !scrolled && !open

  useEffect(() => { setOpen(false); window.scrollTo(0, 0) }, [pathname])
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40)
    on(); window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : '' }, [open])

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:bg-marfim focus:px-4 focus:py-2">Pular para o conteúdo</a>
      <header className={`fixed inset-x-0 top-0 z-50 transition-colors duration-500 ${overHero ? 'bg-transparent' : 'border-b border-espresso/10 bg-marfim/92 backdrop-blur-md'}`}>
        <div className="mx-auto flex h-[72px] max-w-[1320px] items-center justify-between px-5 sm:px-8">
          <Link to="/" aria-label="Studio Lais Vettore — início"><Logo light={overHero} /></Link>
          <nav className="hidden items-center gap-9 lg:flex" aria-label="Principal">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to}
                className={({ isActive }) => `text-[0.74rem] font-semibold uppercase tracking-[0.2em] transition ${overHero ? 'text-marfim/85 hover:text-marfim' : 'text-espresso/70 hover:text-espresso'} ${isActive ? '!text-bronze' : ''}`}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {isConfigured && (
              <Link to={who?.is_admin_account ? '/admin' : session ? '/conta' : '/entrar'}
                className={`hidden text-[0.74rem] font-semibold uppercase tracking-[0.2em] sm:inline ${overHero ? 'text-marfim/85' : 'text-espresso/70'} hover:opacity-100`}>
                {who?.is_admin_account ? 'Painel' : session ? 'Minha conta' : 'Entrar'}
              </Link>
            )}
            <Link to="/agendar" className={overHero ? 'btn-light !px-5 !py-3' : 'btn-dark !px-5 !py-3'}>Agendar</Link>
            <button onClick={() => setOpen((v) => !v)} className={`-mr-2 p-2 lg:hidden ${overHero ? 'text-marfim' : ''}`} aria-label={open ? 'Fechar menu' : 'Abrir menu'} aria-expanded={open}>
              {open ? <Close width={24} height={24} /> : <Menu width={24} height={24} />}
            </button>
          </div>
        </div>
        {open && (
          <div className="h-[calc(100dvh-72px)] overflow-y-auto border-t border-espresso/10 bg-marfim px-6 pb-10 pt-8 lg:hidden">
            <nav className="flex flex-col" aria-label="Menu">
              {[{ to: '/', label: 'Início' }, ...NAV, ...(isConfigured ? [{ to: session ? '/conta' : '/entrar', label: session ? 'Minha conta' : 'Entrar' }] : [])].map((n, i) => (
                <NavLink key={n.to} to={n.to} end className="flex items-baseline justify-between border-b border-espresso/10 py-5">
                  <span className="font-display text-4xl">{n.label}</span>
                  <span className="text-xs text-bronze">0{i + 1}</span>
                </NavLink>
              ))}
            </nav>
            <Link to="/agendar" className="btn-dark mt-8 w-full">Agendar horário</Link>
          </div>
        )}
      </header>

      <main id="conteudo" className="flex-1"><Outlet /></main>

      <Footer />
      <WhatsFloat />
    </div>
  )
}

function WhatsFloat() {
  const { settings } = useSiteData()
  const { pathname } = useLocation()
  if (pathname.startsWith('/agendar')) return null
  const wa = hasWhatsapp(settings.contact)
  return (
    <a href={contactLink(settings.contact)} target="_blank" rel="noopener noreferrer"
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-espresso text-marfim shadow-[0_10px_30px_-10px_rgba(43,31,25,.6)] transition hover:scale-105 hover:bg-cacau"
      aria-label={wa ? 'Conversar pelo WhatsApp' : 'Enviar mensagem pelo Instagram'}>
      {wa ? <Whats width={26} height={26} /> : <Instagram width={24} height={24} />}
    </a>
  )
}

function Footer() {
  const { settings } = useSiteData()
  const c = settings.contact
  return (
    <footer className="grain bg-espresso text-marfim">
      <div className="mx-auto max-w-[1320px] px-5 pb-10 pt-20 sm:px-8">
        <div className="grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Logo light />
            <p className="mt-8 max-w-sm font-display text-3xl leading-tight text-areia">Seu horário, no seu tempo. Agende online quando quiser.</p>
            <Link to="/agendar" className="btn-light mt-8">Agendar agora</Link>
          </div>
          <div className="grid gap-10 sm:grid-cols-3 lg:col-span-7">
            <div>
              <p className="kicker !text-bronze-claro">Visite</p>
              <a href={c.maps_url} target="_blank" rel="noopener noreferrer" className="mt-4 flex gap-2 text-sm leading-relaxed text-marfim/80 hover:text-marfim">
                <Pin className="mt-0.5 shrink-0" /> <span>{c.address}<br />{c.city}<br />CEP {c.cep}</span>
              </a>
            </div>
            <div>
              <p className="kicker !text-bronze-claro">Horários</p>
              <p className="mt-4 text-sm leading-relaxed text-marfim/80">Terça a sábado<br />Agendamentos das 9h às 16h</p>
            </div>
            <div>
              <p className="kicker !text-bronze-claro">Contato</p>
              <ul className="mt-4 space-y-2 text-sm text-marfim/80">
                {c.phone && <li><a className="flex items-center gap-2 hover:text-marfim" href={`tel:+55${c.phone.replace(/\D/g, '')}`}><Phone /> {c.phone}</a></li>}
                <li><a className="flex items-center gap-2 hover:text-marfim" href={contactLink(c)} target="_blank" rel="noopener noreferrer"><Whats /> {hasWhatsapp(c) ? 'WhatsApp' : 'Mensagem'}</a></li>
                <li><a className="flex items-center gap-2 hover:text-marfim" href={`https://instagram.com/${c.instagram}`} target="_blank" rel="noopener noreferrer"><Instagram /> @{c.instagram}</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-20 flex flex-col gap-3 border-t border-marfim/15 pt-6 text-[0.72rem] uppercase tracking-[0.16em] text-marfim/50 sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} Studio Lais Vettore</span>
          <span className="flex gap-6"><Link to="/privacidade" className="hover:text-marfim">Privacidade</Link><Link to="/admin" className="hover:text-marfim">Área do studio</Link></span>
        </div>
      </div>
    </footer>
  )
}

import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Logo } from './Logo'
import { Calendar, Close, Instagram, Menu, Phone, Pin, Whats } from './Icons'
import { useSiteData } from '../context/SiteData'
import { contactLink, hasWhatsapp } from '../lib/whatsapp'

const NAV = [
  { to: '/', label: 'Início' },
  { to: '/servicos', label: 'Serviços e preços' },
  { to: '/galeria', label: 'Fotos' },
  { to: '/meus-horarios', label: 'Meus horários' },
  { to: '/contato', label: 'Endereço e contato' },
]

export function Layout() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { pathname } = useLocation()
  const overHero = pathname === '/' && !scrolled && !open
  const showBar = !pathname.startsWith('/agendar') && !pathname.startsWith('/confirmar')

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
      <header className={`fixed inset-x-0 top-0 z-50 transition-colors duration-500 ${overHero ? 'bg-transparent' : 'border-b border-espresso/10 bg-marfim/95 backdrop-blur-md'}`}>
        <div className="mx-auto flex h-[68px] max-w-[1320px] items-center justify-between px-5 sm:px-8">
          <Link to="/" aria-label="Studio Lais Vettore — início"><Logo light={overHero} /></Link>
          <nav className="hidden items-center gap-8 lg:flex" aria-label="Principal">
            {NAV.slice(1).map((n) => (
              <NavLink key={n.to} to={n.to}
                className={({ isActive }) => `text-[0.74rem] font-semibold uppercase tracking-[0.18em] transition ${overHero ? 'text-marfim/85 hover:text-marfim' : 'text-espresso/70 hover:text-espresso'} ${isActive ? '!text-bronze' : ''}`}>
                {n.label}
              </NavLink>
            ))}
            <Link to="/agendar" className={overHero ? 'btn-light !min-h-0 !px-5 !py-3' : 'btn-dark !min-h-0 !px-5 !py-3'}>Agendar</Link>
          </nav>
          <button onClick={() => setOpen((v) => !v)} className={`-mr-2 flex items-center gap-2 p-3 text-[0.75rem] font-semibold uppercase tracking-[0.16em] lg:hidden ${overHero ? 'text-marfim' : ''}`} aria-label={open ? 'Fechar menu' : 'Abrir menu'} aria-expanded={open}>
            {open ? <Close width={26} height={26} /> : <><span>Menu</span><Menu width={26} height={26} /></>}
          </button>
        </div>
        {open && (
          <div className="h-[calc(100dvh-68px)] overflow-y-auto bg-marfim px-5 pb-10 pt-4 lg:hidden">
            <nav className="flex flex-col" aria-label="Menu">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end className="flex min-h-16 items-center border-b border-espresso/10 font-display text-[2rem] [&.active]:italic [&.active]:text-cacau">
                  {n.label}
                </NavLink>
              ))}
            </nav>
            <Link to="/agendar" className="btn-dark mt-8 w-full text-base">Agendar horário</Link>
          </div>
        )}
      </header>

      <main id="conteudo" className={`flex-1 ${showBar ? 'pb-24 lg:pb-0' : ''}`}><Outlet /></main>

      <Footer />
      {showBar && <BottomBar />}
    </div>
  )
}

/** Barra fixa no celular: os dois botões mais importantes sempre à mão. */
function BottomBar() {
  const { settings } = useSiteData()
  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-espresso/10 bg-marfim/97 px-3 pb-[calc(0.6rem+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur lg:hidden">
        <Link to="/agendar" className="btn-dark flex-1 whitespace-nowrap !px-3 text-[0.85rem] !tracking-[0.08em]"><Calendar width={20} height={20} /> Agendar horário</Link>
        <a href={contactLink(settings.contact)} target="_blank" rel="noopener noreferrer" className="btn border border-espresso/25 !px-4 text-[0.85rem] !tracking-[0.08em]" aria-label="Falar no WhatsApp">
          <Whats width={22} height={22} /> <span className="hidden min-[400px]:inline">WhatsApp</span>
        </a>
      </div>
      <a href={contactLink(settings.contact)} target="_blank" rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-40 hidden h-14 w-14 items-center justify-center rounded-full bg-espresso text-marfim shadow-[0_10px_30px_-10px_rgba(43,31,25,.6)] transition hover:bg-cacau lg:flex"
        aria-label={hasWhatsapp(settings.contact) ? 'Conversar pelo WhatsApp' : 'Enviar mensagem pelo Instagram'}>
        <Whats width={26} height={26} />
      </a>
    </>
  )
}

function Footer() {
  const { settings } = useSiteData()
  const c = settings.contact
  return (
    <footer className="grain bg-espresso text-marfim">
      <div className="mx-auto max-w-[1320px] px-5 pb-28 pt-14 sm:px-8 lg:pb-10">
        <div className="grid gap-10 sm:grid-cols-3">
          <div><Logo light /></div>
          <ul className="space-y-1 text-[0.95rem] text-marfim/85">
            <li><a href={c.maps_url} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-start gap-2 py-1 hover:text-marfim"><Pin className="mt-1 shrink-0" /> <span>{c.address}<br />{c.city}</span></a></li>
            {c.phone && <li><a href={`tel:+55${c.phone.replace(/\D/g, '')}`} className="flex min-h-11 items-center gap-2 hover:text-marfim"><Phone /> {c.phone}</a></li>}
            <li><a href={contactLink(c)} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-2 hover:text-marfim"><Whats /> WhatsApp</a></li>
            <li><a href={`https://instagram.com/${c.instagram}`} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-2 hover:text-marfim"><Instagram /> @{c.instagram}</a></li>
          </ul>
          <div className="text-[0.95rem] text-marfim/85">
            <p className="kicker !text-bronze-claro">Horários</p>
            <p className="mt-2">Terça a sábado<br />das 9h às 16h</p>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-1 border-t border-marfim/15 pt-4 text-[0.72rem] uppercase tracking-[0.14em] text-marfim/50 sm:flex-row sm:justify-between">
          <span className="py-3">© {new Date().getFullYear()} Studio Lais Vettore</span>
          <span className="flex gap-6"><Link to="/privacidade" className="inline-flex min-h-11 items-center hover:text-marfim">Privacidade</Link><Link to="/admin" className="inline-flex min-h-11 items-center hover:text-marfim">Área do studio</Link></span>
        </div>
      </div>
    </footer>
  )
}

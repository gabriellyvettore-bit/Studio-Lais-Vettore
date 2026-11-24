import { Link } from 'react-router-dom'
import { useSiteData } from '../context/SiteData'
import { Img } from '../components/Img'
import { Arrow, Calendar, Clock, Image, Pin, Scissors, Whats } from '../components/Icons'
import { priceSummary } from '../lib/format'
import { contactLink } from '../lib/whatsapp'

export default function Home() {
  const { settings, services, gallery } = useSiteData()
  const h = settings.home
  const c = settings.contact
  const photos = gallery.slice(1, 9)
  const hero = gallery[0]?.image_url ?? 'img/galeria/loiro-quente.webp'

  return (
    <>
      {/* TOPO: quem somos + botão principal */}
      <section className="relative overflow-hidden bg-espresso text-marfim">
        <div className="absolute inset-0 lg:left-[40%]">
          <Img src={hero} alt="Cabelo feito no Studio Lais Vettore" loading="eager" fetchPriority="high" className="object-[50%_15%]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_top,var(--color-espresso)_0%,var(--color-espresso)_35%,rgba(43,31,25,.65)_65%,rgba(43,31,25,.55)_100%)] lg:bg-gradient-to-r lg:from-espresso lg:via-espresso/20 lg:to-transparent" />
        </div>
        <div className="relative mx-auto flex min-h-[78svh] max-w-[1320px] flex-col justify-end px-5 pb-10 pt-28 sm:px-8 lg:min-h-[640px] lg:justify-center lg:pb-16">
          <p className="kicker !text-marfim/90">{h.hero_kicker}</p>
          <h1 className="mt-4 max-w-[12ch] text-[clamp(3rem,9vw,7rem)] leading-[0.9]">
            {h.hero_title.split(' ').map((w, i, a) => i === a.length - 1 ? <em key={i} className="text-areia">{w}</em> : <span key={i}>{w} </span>)}
          </h1>
          <p className="mt-5 max-w-md text-[1.05rem] leading-relaxed text-marfim/85">Agende seu horário em poucos toques, sem cadastro.</p>
          <div className="mt-8 grid gap-3 sm:flex">
            <Link to="/agendar" className="btn-light text-[0.9rem]"><Calendar width={20} height={20} /> Agendar horário</Link>
            <Link to="/servicos" className="btn border border-marfim/40 text-marfim hover:bg-marfim/10">Ver preços</Link>
          </div>
        </div>
      </section>

      {/* ATALHOS */}
      <nav aria-label="Atalhos" className="mx-auto grid max-w-[1320px] grid-cols-2 gap-3 px-5 py-6 sm:grid-cols-4 sm:px-8">
        {[
          { to: '/agendar', icon: Calendar, label: 'Agendar' },
          { to: '/servicos', icon: Scissors, label: 'Preços' },
          { href: contactLink(c), icon: Whats, label: 'WhatsApp' },
          { href: c.maps_url, icon: Pin, label: 'Como chegar' },
        ].map(({ to, href, icon: I, label }) => {
          const cls = 'panel flex min-h-24 flex-col items-center justify-center gap-2 p-3 text-center text-[0.95rem] font-medium transition active:bg-areia hover:border-espresso/40'
          return to
            ? <Link key={label} to={to} className={cls}><I width={26} height={26} className="text-cacau" />{label}</Link>
            : <a key={label} href={href} target="_blank" rel="noopener noreferrer" className={cls}><I width={26} height={26} className="text-cacau" />{label}</a>
        })}
      </nav>

      {/* SERVIÇOS */}
      <section className="mx-auto max-w-[1320px] px-5 py-8 sm:px-8 lg:py-14">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-[2.2rem] leading-none sm:text-5xl">Serviços</h2>
          <Link to="/servicos" className="btn-ghost min-h-11 !text-[0.72rem]">Todos os preços <Arrow /></Link>
        </div>
        <ul className="mt-6 divide-y divide-espresso/10 border-y border-espresso/15">
          {services.map((s) => {
            const p = priceSummary(s)
            return (
              <li key={s.id}>
                <Link to={`/agendar?servico=${s.id}`} className="flex min-h-[68px] items-center justify-between gap-4 py-3 active:bg-areia/50">
                  <span className="font-display text-[1.6rem] leading-tight">{s.name}</span>
                  <span className="flex shrink-0 items-center gap-2 text-right">
                    <span className="text-[0.95rem]">{p.promo && <span className="mr-1 text-[0.65rem] font-semibold uppercase tracking-wider text-bronze-texto">Promo</span>}{p.label}</span>
                    <Arrow className="text-bronze" />
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
        <p className="mt-4 text-[0.95rem] text-espresso/65">Mega hair, maquiagem e outros: <a href={contactLink(c, 'Olá! Gostaria de saber sobre um procedimento que não está no site.')} target="_blank" rel="noopener noreferrer" className="underline decoration-bronze underline-offset-4">fale com a gente no WhatsApp</a>.</p>
      </section>

      {/* FOTOS (deslizar para o lado) */}
      <section className="py-8 lg:py-14">
        <div className="mx-auto flex max-w-[1320px] items-end justify-between gap-4 px-5 sm:px-8">
          <h2 className="text-[2.2rem] leading-none sm:text-5xl">Fotos</h2>
          <Link to="/galeria" className="btn-ghost min-h-11 !text-[0.72rem]"><Image /> Ver todas</Link>
        </div>
        <div className="no-scrollbar mx-auto mt-6 flex max-w-[1320px] snap-x snap-mandatory gap-3 overflow-x-auto px-5 sm:px-8">
          {photos.map((g) => (
            <Link key={g.id} to="/galeria" className="aspect-[4/5] w-[62vw] max-w-[300px] shrink-0 snap-start overflow-hidden">
              <Img src={g.image_url} alt={g.caption ?? 'Trabalho do studio'} />
            </Link>
          ))}
        </div>
      </section>

      {/* ONDE E QUANDO */}
      <section className="mx-auto max-w-[1320px] px-5 pb-12 pt-6 sm:px-8 lg:pb-20">
        <div className="panel grid gap-6 p-5 sm:grid-cols-2 sm:p-8">
          <div className="flex gap-3">
            <Pin width={24} height={24} className="mt-1 shrink-0 text-cacau" />
            <div>
              <p className="font-display text-2xl leading-tight">{c.address}</p>
              <p className="text-espresso/70">{c.city}</p>
              <a href={c.maps_url} target="_blank" rel="noopener noreferrer" className="btn-line mt-4 w-full sm:w-auto">Abrir no mapa</a>
            </div>
          </div>
          <div className="flex gap-3">
            <Clock width={24} height={24} className="mt-1 shrink-0 text-cacau" />
            <div>
              <p className="font-display text-2xl leading-tight">Terça a sábado</p>
              <p className="text-espresso/70">Horários das 9h às 16h</p>
              <a href={contactLink(c)} target="_blank" rel="noopener noreferrer" className="btn-line mt-4 w-full sm:w-auto"><Whats /> Tirar dúvidas</a>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSiteData } from '../context/SiteData'
import { Img } from '../components/Img'
import { Reveal } from '../components/Reveal'
import { Arrow, Pin } from '../components/Icons'
import { TESTIMONIALS } from '../lib/defaults'
import { durationLabel, priceSummary } from '../lib/format'
import { VisitSection } from './Contato'

export default function Home() {
  const { settings, services, gallery } = useSiteData()
  const h = settings.home
  const pick = (i: number) => gallery[i % Math.max(gallery.length, 1)]?.image_url ?? 'img/galeria/loiro-quente.webp'
  const [t, setT] = useState(0)

  return (
    <>
      {/* HERO */}
      <section className="relative h-[100svh] min-h-[620px] overflow-hidden bg-espresso text-marfim">
        <div className="absolute inset-0 lg:left-[38%]">
          <Img src={pick(0)} alt="Cliente com loiro iluminado feito no Studio Lais Vettore" loading="eager" fetchPriority="high" className="object-[50%_15%]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_top,var(--color-espresso)_0%,var(--color-espresso)_38%,rgba(43,31,25,.55)_62%,rgba(43,31,25,.15)_80%,rgba(43,31,25,.45)_100%)] lg:bg-gradient-to-r lg:from-espresso lg:via-espresso/10 lg:to-transparent" />
        </div>
        <div className="relative mx-auto flex h-full max-w-[1320px] flex-col justify-end px-5 pb-14 sm:px-8 lg:justify-center lg:pb-0">
          <p className="kicker !text-bronze-claro">{h.hero_kicker}</p>
          <h1 className="mt-6 max-w-[11ch] text-[clamp(3.4rem,9vw,8.5rem)] leading-[0.88]">
            {h.hero_title.split(' ').map((w, i, a) => i === a.length - 1 ? <em key={i} className="text-areia">{w}</em> : <span key={i}>{w} </span>)}
          </h1>
          <p className="mt-8 max-w-md text-[1.02rem] leading-relaxed text-marfim/80">{h.hero_text}</p>
          <div className="mt-10 flex flex-wrap items-center gap-6">
            <Link to="/agendar" className="btn-light">Agendar horário <Arrow /></Link>
            <Link to="/servicos" className="btn-ghost !text-marfim decoration-areia/50">Ver serviços e preços</Link>
          </div>
        </div>
        <div className="absolute bottom-6 right-8 hidden items-center gap-3 text-[0.68rem] uppercase tracking-[0.3em] text-marfim/60 lg:flex">
          <Pin /> Vila Rosália · Guarulhos
        </div>
      </section>

      {/* ESPECIALIDADES */}
      <div className="border-b border-espresso/10 bg-linho">
        <div className="no-scrollbar mx-auto flex max-w-[1320px] gap-10 overflow-x-auto whitespace-nowrap px-5 py-6 font-display text-2xl italic text-cacau sm:px-8 lg:justify-between">
          {['Loiros', 'Morenas iluminadas', 'Mega hair', 'Cachos', 'Penteados', 'Dia da noiva'].map((s, i) => (
            <span key={s} className="flex items-center gap-10">{s}{i < 5 && <span className="text-sm not-italic text-bronze">✦</span>}</span>
          ))}
        </div>
      </div>

      {/* SOBRE */}
      <section className="mx-auto grid max-w-[1320px] gap-12 px-5 py-24 sm:px-8 lg:grid-cols-12 lg:gap-8 lg:py-36">
        <Reveal className="relative lg:col-span-5">
          <div className="aspect-[4/5] overflow-hidden"><Img src="img/galeria/atendimento-lais.webp" alt="Laís Vettore finalizando o cabelo de uma cliente" /></div>
          <div className="absolute -bottom-8 -right-4 hidden w-40 border-[6px] border-marfim sm:block lg:-right-16 lg:w-52">
            <div className="aspect-[4/5]"><Img src={pick(2)} alt="" /></div>
          </div>
        </Reveal>
        <Reveal className="flex flex-col justify-center lg:col-span-6 lg:col-start-7" delay={120}>
          <p className="kicker">{h.about_title}</p>
          <h2 className="mt-6 text-[clamp(2.4rem,5vw,4.2rem)] leading-[1]">Um cabelo que <em className="text-cacau">conversa</em> com a sua história.</h2>
          <p className="mt-8 max-w-lg text-[1.02rem] leading-[1.8] text-espresso/75">{h.about_text}</p>
          <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-espresso/15 pt-8">
            {[['5.0', 'avaliação das noivas'], ['16', 'madrinhas por evento'], ['4 mil+', 'seguidoras no Instagram']].map(([n, l]) => (
              <div key={l}><dt className="font-display text-4xl">{n}</dt><dd className="mt-1 text-[0.72rem] uppercase leading-snug tracking-[0.12em] text-espresso/55">{l}</dd></div>
            ))}
          </dl>
        </Reveal>
      </section>

      {/* SERVIÇOS */}
      <section className="bg-linho">
        <div className="mx-auto max-w-[1320px] px-5 py-24 sm:px-8 lg:py-32">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="kicker">Serviços</p>
              <h2 className="mt-5 text-[clamp(2.4rem,5vw,4.2rem)] leading-none">O cardápio do studio</h2>
            </div>
            <Link to="/servicos" className="btn-ghost">Tabela completa <Arrow /></Link>
          </div>
          <ul className="mt-14 border-t border-espresso/15">
            {services.slice(0, 6).map((s, i) => {
              const p = priceSummary(s)
              return (
                <Reveal as="li" key={s.id} delay={i * 50}>
                  <Link to={`/agendar?servico=${s.id}`} className="group grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-4 border-b border-espresso/15 py-7 transition sm:grid-cols-[4rem_1fr_7rem_13rem]">
                    <span className="text-xs font-semibold text-bronze">{String(i + 1).padStart(2, '0')}</span>
                    <span>
                      <span className="font-display text-[1.9rem] leading-none transition group-hover:italic sm:text-[2.4rem]">{s.name}</span>
                      <span className="mt-2 block max-w-md text-sm text-espresso/60">{s.description}</span>
                    </span>
                    <span className="hidden text-sm text-espresso/55 sm:block">{durationLabel(s.duration_min)}</span>
                    <span className="text-right">
                      {p.promo && <span className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-bronze">Promoção</span>}
                      <span className="whitespace-nowrap font-display text-xl sm:text-2xl">{p.label}</span>
                    </span>
                  </Link>
                </Reveal>
              )
            })}
          </ul>
          <p className="mt-8 text-sm text-espresso/60">Mega hair, maquiagem, dia da noiva e outros procedimentos: <Link to="/contato" className="underline decoration-bronze underline-offset-4">fale com a gente</Link>.</p>
        </div>
      </section>

      {/* GALERIA */}
      <section className="mx-auto max-w-[1320px] px-5 py-24 sm:px-8 lg:py-32">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="kicker">Galeria</p>
            <h2 className="mt-5 text-[clamp(2.4rem,5vw,4.2rem)] leading-none">Feito aqui</h2>
          </div>
          <Link to="/galeria" className="btn-ghost">Ver todas <Arrow /></Link>
        </div>
        <div className="mt-14 grid grid-cols-2 gap-3 sm:gap-4 lg:auto-rows-[310px] lg:grid-cols-12">
          {[
            ['lg:col-span-5 lg:row-span-2 aspect-[4/5] lg:aspect-auto', 1],
            ['lg:col-span-4 aspect-square lg:aspect-auto', 3],
            ['lg:col-span-3 aspect-square lg:aspect-auto', 4],
            ['lg:col-span-3 aspect-square lg:aspect-auto', 5],
            ['lg:col-span-4 aspect-square lg:aspect-auto', 6],
          ].map(([cls, i], k) => (
            <Reveal key={k} delay={k * 70} className={`${cls} ${k === 0 ? 'col-span-2' : ''} overflow-hidden`}>
              <Img src={pick(i as number)} alt={gallery[(i as number) % gallery.length]?.caption ?? 'Trabalho do studio'} className="transition duration-[1.4s] ease-[var(--ease-suave)] hover:scale-[1.04]" />
            </Reveal>
          ))}
        </div>
      </section>

      {/* NOIVAS */}
      <section className="grain relative overflow-hidden bg-espresso text-marfim">
        <div className="mx-auto grid max-w-[1320px] items-center gap-12 px-5 py-24 sm:px-8 lg:grid-cols-2 lg:py-0">
          <Reveal className="order-2 lg:order-1 lg:py-32">
            <p className="kicker !text-bronze-claro">Dia da noiva</p>
            <h2 className="mt-6 text-[clamp(2.6rem,5.5vw,4.8rem)] leading-[0.95]">O sim merece <em className="text-areia">calma</em>, cuidado e um espelho só seu.</h2>
            <p className="mt-8 max-w-md leading-relaxed text-marfim/75">{h.bride_text}</p>
            <Link to="/noivas" className="btn-light mt-10">Conhecer o dia da noiva</Link>
          </Reveal>
          <Reveal className="order-1 aspect-[4/5] overflow-hidden lg:order-2 lg:h-[760px] lg:aspect-auto" delay={150}>
            <Img src="img/galeria/noiva-coque.webp" alt="Coque de noiva com orquídeas feito no studio" />
          </Reveal>
        </div>
      </section>

      {/* DEPOIMENTOS */}
      <section className="mx-auto max-w-[1100px] px-5 py-24 text-center sm:px-8 lg:py-32">
        <p className="kicker">Quem já sentou na nossa cadeira</p>
        <blockquote key={t} className="mx-auto mt-10 max-w-3xl font-display text-[clamp(1.8rem,3.6vw,2.9rem)] leading-[1.2] [animation:fade_.7s_ease]">
          “{TESTIMONIALS[t].text}”
        </blockquote>
        <p className="mt-8 text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-cacau">{TESTIMONIALS[t].name} · avaliação 5 estrelas</p>
        <div className="mt-8 flex justify-center gap-3">
          {TESTIMONIALS.map((x, i) => (
            <button key={x.name} onClick={() => setT(i)} aria-label={`Depoimento de ${x.name}`}
              className={`h-[3px] transition-all ${i === t ? 'w-10 bg-espresso' : 'w-5 bg-espresso/20 hover:bg-espresso/40'}`} />
          ))}
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="border-y border-espresso/10 bg-linho">
        <div className="mx-auto grid max-w-[1320px] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-4">
          <div>
            <p className="kicker">Agendamento online</p>
            <h2 className="mt-5 text-4xl leading-none">Simples assim.</h2>
          </div>
          {[
            ['Escolha', 'o serviço e o comprimento do seu cabelo — o valor aparece na hora.'],
            ['Reserve', 'um dos horários livres da agenda, a qualquer hora do dia.'],
            ['Pronto', 'a Laís confirma seu horário e você acompanha tudo pela sua conta.'],
          ].map(([a, b], i) => (
            <Reveal key={a} delay={i * 100}>
              <span className="font-display text-6xl text-bronze/60">{i + 1}</span>
              <p className="mt-3 leading-relaxed text-espresso/70"><strong className="font-display text-2xl font-normal text-espresso">{a}</strong> {b}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <VisitSection />
    </>
  )
}

import { useSiteData } from '../context/SiteData'
import { Img } from '../components/Img'
import { Reveal } from '../components/Reveal'
import { Whats } from '../components/Icons'
import { contactLink } from '../lib/whatsapp'
import { TESTIMONIALS } from '../lib/defaults'

const ITENS = ['Teste de penteado e maquiagem', 'Penteado e maquiagem no grande dia', 'Sala privativa', 'Atendimento para até 16 madrinhas', 'Manicure e pedicure', 'Design de sobrancelhas e cílios', 'Acompanhamento até o ensaio de fotos', 'Assessoria de beleza do início ao fim']

export default function Noivas() {
  const { settings } = useSiteData()
  return (
    <>
      <section className="grain relative bg-espresso text-marfim">
        <div className="mx-auto grid max-w-[1320px] gap-10 px-5 pb-20 pt-32 sm:px-8 lg:grid-cols-12 lg:pt-40">
          <div className="lg:col-span-6 lg:pt-10">
            <p className="kicker !text-bronze-claro">Dia da noiva</p>
            <h1 className="mt-6 text-[clamp(3rem,7.5vw,6.5rem)] leading-[0.9]">Para o dia em que <em className="text-areia">tudo</em> precisa estar perfeito.</h1>
            <p className="mt-8 max-w-md leading-relaxed text-marfim/75">{settings.home.bride_text}</p>
            <a href={contactLink(settings.contact, 'Olá! Gostaria de saber sobre os pacotes de dia da noiva.')} target="_blank" rel="noopener noreferrer" className="btn-light mt-10"><Whats /> Pedir orçamento</a>
            <p className="mt-4 text-xs uppercase tracking-[0.16em] text-marfim/50">Recomendamos reservar de 2 a 12 meses antes</p>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:col-span-6">
            <div className="aspect-[3/4] overflow-hidden"><Img src="img/galeria/noiva-coque.webp" alt="Penteado de noiva" loading="eager" /></div>
            <div className="mt-16 aspect-[3/4] overflow-hidden"><Img src="img/galeria/noiva-coque-2.webp" alt="Detalhes do penteado de noiva" loading="eager" /></div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1320px] gap-14 px-5 py-24 sm:px-8 lg:grid-cols-12 lg:py-32">
        <div className="lg:col-span-4">
          <p className="kicker">O que inclui</p>
          <h2 className="mt-5 text-5xl leading-none">Pacotes do Básico ao <em className="text-cacau">Diamante.</em></h2>
          <p className="mt-6 text-espresso/65">Monte o seu dia com a Laís: cada pacote é ajustado ao seu estilo, à cerimônia e ao número de madrinhas.</p>
        </div>
        <ul className="grid gap-x-10 sm:grid-cols-2 lg:col-span-7 lg:col-start-6">
          {ITENS.map((i, k) => (
            <Reveal as="li" key={i} delay={k * 40} className="flex items-baseline gap-4 border-b border-espresso/15 py-5">
              <span className="text-xs font-semibold text-bronze">{String(k + 1).padStart(2, '0')}</span>
              <span className="font-display text-2xl">{i}</span>
            </Reveal>
          ))}
        </ul>
      </section>

      <section className="bg-linho">
        <div className="mx-auto grid max-w-[1320px] gap-10 px-5 py-24 sm:px-8 lg:grid-cols-3">
          {TESTIMONIALS.slice(0, 3).map((t) => (
            <Reveal key={t.name}>
              <p className="font-display text-2xl leading-snug">“{t.text}”</p>
              <p className="mt-5 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-cacau">{t.name}</p>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  )
}

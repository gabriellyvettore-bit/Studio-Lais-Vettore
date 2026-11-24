import { Link } from 'react-router-dom'
import { useSiteData } from '../context/SiteData'
import { PageHeader } from '../components/PageHeader'
import { Reveal } from '../components/Reveal'
import { Arrow, Whats } from '../components/Icons'
import { HAIR_LENGTHS, WEEKDAYS_SHORT, durationLabel, effectivePrice, money, promoActive } from '../lib/format'
import { contactLink } from '../lib/whatsapp'
import type { Service, ServicePrice } from '../lib/types'

function PriceCell({ p }: { p: ServicePrice | undefined }) {
  if (!p || p.unavailable) return <span className="text-sm italic text-cacau">Só pelo WhatsApp</span>
  if (p.price == null) return <span className="text-sm italic text-cacau">Valor combinado no salão</span>
  const promo = promoActive(p)
  return (
    <span className="whitespace-nowrap">
      {promo && <s className="mr-2 text-sm text-espresso/40">{money(p.price)}</s>}
      <span className={`font-display text-2xl ${promo ? 'text-bronze' : ''}`}>{money(effectivePrice(p))}</span>
    </span>
  )
}

function Rules({ s }: { s: Service }) {
  const days = s.allowed_weekdays.length === 5 && [2, 3, 4, 5, 6].every((d) => s.allowed_weekdays.includes(d))
    ? null : s.allowed_weekdays.map((d) => WEEKDAYS_SHORT[d]).join(', ')
  const win = s.start_window_from && s.start_window_to ? `início das ${s.start_window_from.slice(0, 5)} às ${s.start_window_to.slice(0, 5)}` : null
  const parts = [durationLabel(s.duration_min), days && `somente ${days}`, win].filter(Boolean)
  return <p className="mt-2 text-[0.72rem] uppercase tracking-[0.14em] text-espresso/65">{parts.join(' · ')}</p>
}

export default function Servicos() {
  const { services, settings } = useSiteData()
  const cats = [...new Set(services.map((s) => s.category))]

  return (
    <>
      <PageHeader kicker="Serviços & valores" title={<>Preço justo para <em className="text-cacau">cada comprimento.</em></>}>
        Alguns serviços variam conforme o tamanho do cabelo. Não sabe qual é o seu? No agendamento mostramos um guia rápido — e o valor final é sempre confirmado pela Laís.
      </PageHeader>

      <section className="mx-auto max-w-[1320px] px-5 pb-24 sm:px-8">
        {cats.map((cat) => (
          <div key={cat} className="mt-14 first:mt-4">
            <h2 className="kicker">{cat}</h2>
            <div className="mt-5 border-t border-espresso/20">
              {services.filter((s) => s.category === cat).map((s) => (
                <Reveal key={s.id} className="grid gap-6 border-b border-espresso/15 py-9 lg:grid-cols-12">
                  <div className="lg:col-span-5">
                    <h3 className="text-[2.2rem] leading-none">{s.name}</h3>
                    {s.description && <p className="mt-3 max-w-md text-[0.95rem] leading-relaxed text-espresso/65">{s.description}</p>}
                    <Rules s={s} />
                  </div>
                  <div className="lg:col-span-5">
                    {s.price_mode === 'unico' ? (
                      <div className="flex items-baseline justify-between border-b border-dashed border-espresso/15 pb-2">
                        <span className="text-sm text-espresso/60">Qualquer comprimento</span>
                        <PriceCell p={s.service_prices[0]} />
                      </div>
                    ) : (
                      <dl className="grid grid-cols-2 gap-x-8 gap-y-3">
                        {HAIR_LENGTHS.map((l) => (
                          <div key={l.value} className="flex items-baseline justify-between border-b border-dashed border-espresso/15 pb-2">
                            <dt className="text-sm text-espresso/60">{l.label}</dt>
                            <dd><PriceCell p={s.service_prices.find((p) => p.hair_length === l.value)} /></dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                  <div className="flex items-start lg:col-span-2 lg:justify-end">
                    {s.bookable_online
                      ? <Link to={`/agendar?servico=${s.id}`} className="btn-line !px-5">Agendar <Arrow /></Link>
                      : <a href={contactLink(settings.contact, `Olá! Gostaria de agendar: ${s.name}.`)} target="_blank" rel="noopener noreferrer" className="btn-line !px-5"><Whats /> Combinar</a>}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        ))}

        <div className="mt-20 grid gap-8 bg-linho p-8 sm:p-12 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="kicker">Outros procedimentos</p>
            <p className="mt-4 max-w-2xl font-display text-3xl leading-tight">Mega hair, maquiagem, dia da noiva, corte sem escova e tudo o que não está na lista: combine direto com a gente.</p>
          </div>
          <a href={contactLink(settings.contact, 'Olá! Gostaria de saber sobre um procedimento que não encontrei no site.')} target="_blank" rel="noopener noreferrer" className="btn-dark"><Whats /> Falar com o studio</a>
        </div>
      </section>
    </>
  )
}

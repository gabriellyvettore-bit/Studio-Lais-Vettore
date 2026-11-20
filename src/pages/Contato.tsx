import { useSiteData } from '../context/SiteData'
import { PageHeader } from '../components/PageHeader'
import { Instagram, Phone, Pin, Whats } from '../components/Icons'
import { contactLink, hasWhatsapp } from '../lib/whatsapp'
import { Link } from 'react-router-dom'

export function VisitSection() {
  const { settings } = useSiteData()
  const c = settings.contact
  const q = encodeURIComponent(`${c.address.replace('—', '-')}, ${c.city.replace('—', '-')}`)
  return (
    <section className="mx-auto grid max-w-[1320px] gap-10 px-5 py-24 sm:px-8 lg:grid-cols-12 lg:py-32">
      <div className="lg:col-span-5">
        <p className="kicker">Visite o studio</p>
        <h2 className="mt-5 text-[clamp(2.4rem,5vw,4rem)] leading-none">Vila Rosália,<br /><em className="text-cacau">Guarulhos.</em></h2>
        <ul className="mt-10 space-y-5 text-[0.98rem]">
          <li className="flex gap-3"><Pin className="mt-1 shrink-0 text-bronze" /><a href={c.maps_url} target="_blank" rel="noopener noreferrer" className="hover:underline">{c.address}<br />{c.city} · CEP {c.cep}</a></li>
          {c.phone && <li className="flex gap-3"><Phone className="mt-0.5 shrink-0 text-bronze" /><a href={`tel:+55${c.phone.replace(/\D/g, '')}`} className="hover:underline">{c.phone}</a></li>}
          <li className="flex gap-3"><Instagram className="mt-0.5 shrink-0 text-bronze" /><a href={`https://instagram.com/${c.instagram}`} target="_blank" rel="noopener noreferrer" className="hover:underline">@{c.instagram}</a></li>
        </ul>
        <div className="mt-10 grid max-w-sm grid-cols-[auto_1fr] gap-x-8 gap-y-2 border-t border-espresso/15 pt-6 text-sm">
          <span className="text-espresso/55">Terça a sábado</span><span>9h às 16h (início)</span>
          <span className="text-espresso/55">Domingo e segunda</span><span>Fechado</span>
        </div>
        <div className="mt-10 grid gap-3 sm:flex sm:flex-wrap sm:gap-4">
          <a href={contactLink(c)} target="_blank" rel="noopener noreferrer" className="btn-dark w-full sm:w-auto"><Whats /> {hasWhatsapp(c) ? 'Chamar no WhatsApp' : 'Enviar mensagem'}</a>
          <Link to="/agendar" className="btn-line w-full sm:w-auto">Agendar online</Link>
        </div>
      </div>
      <div className="min-h-[380px] overflow-hidden border border-espresso/10 grayscale-[.6] sepia-[.15] lg:col-span-7">
        <iframe title="Mapa do Studio Lais Vettore" className="h-full min-h-[380px] w-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade"
          src={`https://www.google.com/maps?q=${q}&output=embed`} />
      </div>
    </section>
  )
}

export default function Contato() {
  const { settings } = useSiteData()
  return (
    <>
      <PageHeader kicker="Contato" title={<>Vamos conversar <em className="text-cacau">sobre o seu cabelo?</em></>}>
        Procedimentos que não estão no agendamento online — mega hair, maquiagem, dia da noiva, corte sem escova e outros — são combinados direto com a Laís.
        <div className="mt-8">
          <a href={contactLink(settings.contact, 'Olá! Gostaria de saber sobre um procedimento que não encontrei no site.')} target="_blank" rel="noopener noreferrer" className="btn-dark"><Whats /> Falar com a Laís</a>
        </div>
      </PageHeader>
      <VisitSection />
    </>
  )
}

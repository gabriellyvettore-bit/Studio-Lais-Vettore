import { useSiteData } from '../context/SiteData'
import { Clock, Instagram, Phone, Pin, Whats } from '../components/Icons'
import { contactLink } from '../lib/whatsapp'

export default function Contato() {
  const { settings } = useSiteData()
  const c = settings.contact
  const Row = ({ icon: I, children }: { icon: typeof Pin; children: React.ReactNode }) => (
    <li className="flex gap-4 border-b border-espresso/10 py-5"><I width={24} height={24} className="mt-0.5 shrink-0 text-cacau" /><div className="text-[1.05rem]">{children}</div></li>
  )
  return (
    <section className="mx-auto max-w-2xl px-5 pb-16 pt-28 sm:px-8 sm:pt-36">
      <h1 className="text-[2.6rem] leading-none">Endereço e contato</h1>
      <ul className="mt-6">
        <Row icon={Pin}>{c.address}<br />{c.city} · CEP {c.cep}<a href={c.maps_url} target="_blank" rel="noopener noreferrer" className="btn-line mt-3 w-full">Abrir no mapa</a></Row>
        <Row icon={Clock}>Terça a sábado, das 9h às 16h<br /><span className="text-espresso/60">Domingo e segunda: fechado</span></Row>
        <Row icon={Whats}>WhatsApp<a href={contactLink(c)} target="_blank" rel="noopener noreferrer" className="btn-dark mt-3 w-full"><Whats /> Chamar no WhatsApp</a></Row>
        {c.phone && <Row icon={Phone}><a href={`tel:+55${c.phone.replace(/\D/g, '')}`} className="underline underline-offset-4">{c.phone}</a></Row>}
        <Row icon={Instagram}><a href={`https://instagram.com/${c.instagram}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">@{c.instagram}</a></Row>
      </ul>
    </section>
  )
}

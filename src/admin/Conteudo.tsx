import { useEffect, useState } from 'react'
import { db, friendlyError } from '../lib/supabase'
import type { ContactSettings, HomeSettings } from '../lib/types'
import { AdminTitle, Field, toast } from './ui'
import { useSiteData } from '../context/SiteData'
import { maskPhone } from '../lib/format'

export default function Conteudo() {
  const { settings, reload } = useSiteData()
  const [home, setHome] = useState<HomeSettings>(settings.home)
  const [contact, setContact] = useState<ContactSettings>(settings.contact)
  useEffect(() => { setHome(settings.home); setContact(settings.contact) }, [settings])

  async function save(key: 'home' | 'contact', value: object) {
    const { error } = await db().from('site_settings').upsert({ key, value })
    if (error) return toast(friendlyError(error), true)
    toast('Salvo! O site já foi atualizado.'); void reload()
  }
  const H = (k: keyof HomeSettings, label: string, rows = 1) => (
    <Field label={label}>{rows > 1
      ? <textarea rows={rows} className="field-box" value={home[k]} onChange={(e) => setHome({ ...home, [k]: e.target.value })} maxLength={1200} />
      : <input className="field-box" value={home[k]} onChange={(e) => setHome({ ...home, [k]: e.target.value })} maxLength={160} />}</Field>
  )
  const C = (k: keyof ContactSettings, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Field label={label}><input className="field-box" value={contact[k]} onChange={(e) => setContact({ ...contact, [k]: k === 'phone' || (k === 'whatsapp' && /^[\d\s()+-]*$/.test(e.target.value)) ? maskPhone(e.target.value) : e.target.value })} maxLength={300} {...extra} /></Field>
  )

  return (
    <>
      <AdminTitle kicker="Site" title="Textos e contato" />
      <div className="grid gap-8 xl:grid-cols-2">
        <section className="panel space-y-4 p-6">
          <h2 className="text-3xl">Contato</h2>
          {C('whatsapp', 'WhatsApp do studio (número com DDD ou link wa.me)', { placeholder: '(11) 90000-0000 ou https://wa.me/message/…' })}
          <p className="-mt-2 text-xs text-espresso/50">Todos os botões de WhatsApp do site usam este número.</p>
          {C('phone', 'Telefone fixo', { inputMode: 'tel' })}
          {C('instagram', 'Instagram (sem @)')}
          {C('address', 'Endereço')}
          <div className="grid gap-4 sm:grid-cols-2">{C('city', 'Cidade')}{C('cep', 'CEP')}</div>
          {C('maps_url', 'Link do Google Maps', { type: 'url' })}
          <button onClick={() => save('contact', { ...contact, instagram: contact.instagram.replace(/^@/, '') })} className="btn-dark">Salvar contato</button>
        </section>
        <section className="panel space-y-4 p-6">
          <h2 className="text-3xl">Página inicial</h2>
          {H('hero_kicker', 'Frase pequena do topo')}
          {H('hero_title', 'Título principal (a última palavra fica em itálico)')}
          {H('hero_text', 'Texto de abertura', 3)}
          {H('about_title', 'Título da seção sobre')}
          {H('about_text', 'Sobre a Laís', 5)}
          {H('bride_text', 'Texto do dia da noiva', 3)}
          <button onClick={() => save('home', home)} className="btn-dark">Salvar textos</button>
        </section>
      </div>
    </>
  )
}

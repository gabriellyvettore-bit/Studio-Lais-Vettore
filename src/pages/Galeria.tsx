import { useEffect, useState } from 'react'
import { useSiteData } from '../context/SiteData'
import { PageHeader } from '../components/PageHeader'
import { Img } from '../components/Img'
import { Reveal } from '../components/Reveal'
import { ArrowLeft, Arrow, Close } from '../components/Icons'

export default function Galeria() {
  const { gallery } = useSiteData()
  const cats = ['Todas', ...new Set(gallery.map((g) => g.category))]
  const [cat, setCat] = useState('Todas')
  const [open, setOpen] = useState<number | null>(null)
  const items = cat === 'Todas' ? gallery : gallery.filter((g) => g.category === cat)

  useEffect(() => {
    if (open == null) return
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null)
      if (e.key === 'ArrowRight') setOpen((i) => (i! + 1) % items.length)
      if (e.key === 'ArrowLeft') setOpen((i) => (i! - 1 + items.length) % items.length)
    }
    window.addEventListener('keydown', on)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', on); document.body.style.overflow = '' }
  }, [open, items.length])

  return (
    <>
      <PageHeader kicker="Galeria" title={<>Cores que <em className="text-cacau">saíram daqui.</em></>} />
      <section className="mx-auto max-w-[1320px] px-5 pb-28 sm:px-8">
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-2 sm:mx-0 sm:px-0">
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`chip shrink-0 transition ${c === cat ? 'border-espresso bg-espresso text-marfim' : 'hover:border-espresso'}`}>{c}</button>
          ))}
        </div>
        <div className="mt-10 columns-2 gap-3 sm:gap-4 lg:columns-3">
          {items.map((g, i) => (
            <Reveal key={g.id} delay={(i % 6) * 60} className="mb-3 break-inside-avoid sm:mb-4">
              <button onClick={() => setOpen(i)} className="group relative block w-full overflow-hidden text-left">
                <Img src={g.image_url} alt={g.caption ?? 'Trabalho do studio'} className="!h-auto transition duration-[1.2s] group-hover:scale-[1.03]" />
                {g.caption && <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-espresso/70 to-transparent p-4 pt-10 text-sm text-marfim opacity-0 transition group-hover:opacity-100">{g.caption}</span>}
              </button>
            </Reveal>
          ))}
        </div>
      </section>

      {open != null && items[open] && (
        <div role="dialog" aria-modal="true" aria-label="Foto ampliada" className="fixed inset-0 z-[70] flex items-center justify-center bg-espresso/95 p-4" onClick={() => setOpen(null)}>
          <button className="absolute right-4 top-4 p-3 text-marfim" aria-label="Fechar"><Close width={26} height={26} /></button>
          <button className="absolute left-2 p-3 text-marfim sm:left-6" aria-label="Anterior" onClick={(e) => { e.stopPropagation(); setOpen((open - 1 + items.length) % items.length) }}><ArrowLeft width={28} height={28} /></button>
          <figure className="max-h-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <Img src={items[open].image_url} alt={items[open].caption ?? ''} className="!h-auto max-h-[82vh] !w-auto !object-contain" />
            {items[open].caption && <figcaption className="mt-4 text-center font-display text-xl italic text-areia">{items[open].caption}</figcaption>}
          </figure>
          <button className="absolute right-2 p-3 text-marfim sm:right-6" aria-label="Próxima" onClick={(e) => { e.stopPropagation(); setOpen((open + 1) % items.length) }}><Arrow width={28} height={28} /></button>
        </div>
      )}
    </>
  )
}

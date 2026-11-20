import { useEffect, useState } from 'react'
import { db, assetUrl, friendlyError } from '../lib/supabase'
import type { GalleryItem } from '../lib/types'
import { AdminTitle, toast, uploadImage } from './ui'
import { useSiteData } from '../context/SiteData'
import { Down, Plus, Trash, Up } from '../components/Icons'

const CATS = ['Loiros', 'Morenas', 'Cachos', 'Noivas', 'Cortes', 'Penteados', 'Studio']

export default function GaleriaAdmin() {
  const { reload } = useSiteData()
  const [list, setList] = useState<GalleryItem[]>([])
  const [busy, setBusy] = useState(false)
  async function load() {
    const { data, error } = await db().from('gallery_items').select('*').order('sort_order')
    if (error) toast(friendlyError(error), true)
    setList((data as GalleryItem[]) ?? [])
  }
  useEffect(() => { void load() }, [])
  const done = () => { void load(); void reload() }

  async function upload(files: FileList | null, replace?: GalleryItem) {
    if (!files?.length) return
    setBusy(true)
    try {
      for (const file of Array.from(files).slice(0, 12)) {
        const path = await uploadImage('galeria', 'site', file)
        const url = db().storage.from('galeria').getPublicUrl(path).data.publicUrl
        if (replace) {
          const { error } = await db().from('gallery_items').update({ image_url: url, storage_path: path }).eq('id', replace.id)
          if (error) throw error
          if (replace.storage_path) await db().storage.from('galeria').remove([replace.storage_path])
        } else {
          const max = Math.max(0, ...list.map((g) => g.sort_order))
          const { error } = await db().from('gallery_items').insert({ image_url: url, storage_path: path, category: 'Loiros', sort_order: max + 10 })
          if (error) throw error
        }
      }
      toast(replace ? 'Foto substituída' : 'Fotos adicionadas')
    } catch (e) { toast((e as Error).message || friendlyError(e), true) }
    setBusy(false); done()
  }
  async function update(g: GalleryItem, p: Partial<GalleryItem>) {
    const { error } = await db().from('gallery_items').update(p).eq('id', g.id)
    if (error) return toast(friendlyError(error), true)
    setList((l) => l.map((x) => (x.id === g.id ? { ...x, ...p } : x))); void reload()
  }
  async function remove(g: GalleryItem) {
    if (!confirm('Remover esta foto do site?')) return
    const { error } = await db().from('gallery_items').delete().eq('id', g.id)
    if (error) return toast(friendlyError(error), true)
    if (g.storage_path) await db().storage.from('galeria').remove([g.storage_path])
    done()
  }
  async function move(i: number, dir: -1 | 1) {
    const a = list[i], b = list[i + dir]
    if (!a || !b) return
    await Promise.all([update(a, { sort_order: b.sort_order }), update(b, { sort_order: a.sort_order })])
    done()
  }

  return (
    <>
      <AdminTitle kicker="Site" title="Galeria" actions={
        <label className={`btn-dark cursor-pointer ${busy ? 'opacity-50' : ''}`}><Plus /> {busy ? 'Enviando…' : 'Adicionar fotos'}
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={busy} onChange={(e) => upload(e.target.files)} />
        </label>} />
      <p className="-mt-4 mb-6 text-sm text-espresso/55">As fotos são otimizadas automaticamente. A ordem aqui é a ordem no site — as primeiras aparecem na página inicial.</p>
      {list.length === 0 && <p className="panel p-10 text-center text-espresso/55">Nenhuma foto ainda. Toque em “Adicionar fotos”.</p>}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {list.map((g, i) => (
          <li key={g.id} className={`panel overflow-hidden ${!g.active ? 'opacity-50' : ''}`}>
            <div className="relative aspect-[4/5] bg-areia">
              <img src={assetUrl(g.image_url)} alt={g.caption ?? ''} className="h-full w-full object-cover" loading="lazy" />
              <span className="absolute left-2 top-2 bg-espresso/80 px-2 py-0.5 text-xs text-marfim">{i + 1}</span>
            </div>
            <div className="space-y-2 p-3">
              <input className="field-box !py-1.5" placeholder="Legenda" defaultValue={g.caption ?? ''} maxLength={160} onBlur={(e) => e.target.value !== (g.caption ?? '') && update(g, { caption: e.target.value || null })} />
              <select className="field-box !py-1.5" value={g.category} onChange={(e) => update(g, { category: e.target.value })}>
                {[...new Set([...CATS, g.category])].map((c) => <option key={c}>{c}</option>)}
              </select>
              <div className="flex items-center justify-between pt-1">
                <div className="flex">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="p-2.5 disabled:opacity-20" aria-label="Mover para antes"><Up /></button>
                  <button onClick={() => move(i, 1)} disabled={i === list.length - 1} className="p-2.5 disabled:opacity-20" aria-label="Mover para depois"><Down /></button>
                </div>
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" className="accent-[#2b1f19]" checked={g.active} onChange={(e) => update(g, { active: e.target.checked })} /> visível</label>
                <label className="cursor-pointer text-xs underline">trocar<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => upload(e.target.files, g)} /></label>
                <button onClick={() => remove(g)} className="p-2.5 text-erro" aria-label="Remover"><Trash /></button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

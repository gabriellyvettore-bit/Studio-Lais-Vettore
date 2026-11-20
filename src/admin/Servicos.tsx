import { useEffect, useState } from 'react'
import { db, friendlyError } from '../lib/supabase'
import { HAIR_LENGTHS, WEEKDAYS_SHORT, durationLabel, priceSummary, promoActive } from '../lib/format'
import type { HairLength, PriceMode, Service, ServicePrice } from '../lib/types'
import { AdminTitle, Field, Modal, toast } from './ui'
import { useSiteData } from '../context/SiteData'
import { Down, Edit, Plus, Up } from '../components/Icons'
import { useStaff } from './useStaff'

type PriceRow = Omit<ServicePrice, 'id' | 'service_id'> & { id?: string }

const emptyRow = (l: HairLength | null): PriceRow => ({ hair_length: l, price: null, duration_min: null, unavailable: false, promo_price: null, promo_from: null, promo_until: null })

export default function ServicosAdmin() {
  const { reload } = useSiteData()
  const [list, setList] = useState<Service[]>([])
  const [edit, setEdit] = useState<Service | 'new' | null>(null)
  const { staff } = useStaff()
  const staffNames = (ids: string[]) => staff.filter((x) => ids.includes(x.id)).map((x) => x.name).join(', ')
  async function load() {
    const { data, error } = await db().from('services').select('*, service_prices(*)').order('sort_order')
    if (error) toast(friendlyError(error), true)
    setList((data as Service[]) ?? [])
  }
  useEffect(() => { void load() }, [])

  async function move(i: number, dir: -1 | 1) {
    const a = list[i], b = list[i + dir]
    if (!a || !b) return
    await Promise.all([
      db().from('services').update({ sort_order: b.sort_order }).eq('id', a.id),
      db().from('services').update({ sort_order: a.sort_order === b.sort_order ? a.sort_order + dir : a.sort_order }).eq('id', b.id),
    ])
    void load(); void reload()
  }

  return (
    <>
      <AdminTitle kicker="Cardápio" title="Serviços e preços" actions={<button onClick={() => setEdit('new')} className="btn-dark"><Plus /> Novo serviço</button>} />
      <ul className="space-y-2">
        {list.map((s, i) => {
          const p = priceSummary(s)
          const promo = s.service_prices.some((x) => promoActive(x))
          return (
            <li key={s.id} className={`panel flex flex-wrap items-center gap-4 p-4 ${!s.active ? 'opacity-50' : ''}`}>
              <div className="flex flex-col">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="p-2.5 disabled:opacity-20" aria-label="Subir"><Up /></button>
                <button onClick={() => move(i, 1)} disabled={i === list.length - 1} className="p-2.5 disabled:opacity-20" aria-label="Descer"><Down /></button>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-2xl">{s.name} {promo && <span className="chip ml-2 border-bronze !text-[0.55rem] text-bronze">promoção</span>}</p>
                <p className="text-sm text-espresso/55">
                  {s.category} · {durationLabel(s.duration_min)} · {s.allowed_weekdays.map((d) => WEEKDAYS_SHORT[d]).join(', ')}
                  {s.start_window_from && ` · ${s.start_window_from.slice(0, 5)}–${s.start_window_to?.slice(0, 5)}`}
                  {s.staff_only && staffNames(s.staff_only) && ` · só ${staffNames(s.staff_only)}`}
                  {!s.bookable_online && ' · só pelo WhatsApp'}{!s.active && ' · INATIVO'}
                </p>
              </div>
              <span className="font-display text-xl">{p.label}</span>
              <button onClick={() => setEdit(s)} className="btn-line !px-4 !py-2.5"><Edit /> Editar</button>
            </li>
          )
        })}
      </ul>
      {edit && <ServiceModal service={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={() => { void load(); void reload() }} />}
    </>
  )
}

function ServiceModal({ service, onClose, onSaved }: { service: Service | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    name: service?.name ?? '', description: service?.description ?? '', category: service?.category ?? 'Cabelo',
    price_mode: (service?.price_mode ?? 'unico') as PriceMode, duration_min: service?.duration_min ?? 60,
    allowed_weekdays: service?.allowed_weekdays ?? [2, 3, 4, 5, 6],
    start_window_from: service?.start_window_from?.slice(0, 5) ?? '', start_window_to: service?.start_window_to?.slice(0, 5) ?? '',
    bookable_online: service?.bookable_online ?? true, active: service?.active ?? true, featured: service?.featured ?? false,
    staff_only: service?.staff_only ?? null as string[] | null,
  })
  const { staff } = useStaff()
  const initRows = (mode: PriceMode): PriceRow[] => mode === 'unico'
    ? [service?.service_prices.find((p) => p.hair_length == null) ?? emptyRow(null)]
    : HAIR_LENGTHS.map((l) => service?.service_prices.find((p) => p.hair_length === l.value) ?? emptyRow(l.value))
  const [rows, setRows] = useState<PriceRow[]>(initRows(f.price_mode))
  const [busy, setBusy] = useState(false)

  useEffect(() => { setRows(initRows(f.price_mode)) }, [f.price_mode]) // eslint-disable-line react-hooks/exhaustive-deps
  const setRow = (i: number, p: Partial<PriceRow>) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...p } : x)))
  const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (f.name.trim().length < 2) return toast('Informe o nome', true)
    if (!f.allowed_weekdays.length) return toast('Escolha pelo menos um dia', true)
    setBusy(true)
    try {
      const row = {
        ...f, name: f.name.trim(), description: f.description || null,
        start_window_from: f.start_window_from || null, start_window_to: f.start_window_to || null,
        staff_only: f.staff_only && f.staff_only.length ? f.staff_only : null,
        allowed_weekdays: [...f.allowed_weekdays].sort(),
        ...(service ? {} : { sort_order: 1000 }),
      }
      const res = service
        ? await db().from('services').update(row).eq('id', service.id).select().single()
        : await db().from('services').insert(row).select().single()
      if (res.error) throw res.error
      const sid = (res.data as Service).id
      // remove preços do outro modo (ex.: trocou de único para por comprimento)
      const keep = rows.filter((r) => r.id).map((r) => r.id!)
      const stale = (service?.service_prices ?? []).filter((p) => !keep.includes(p.id)).map((p) => p.id)
      if (stale.length) { const d = await db().from('service_prices').delete().in('id', stale); if (d.error) throw d.error }
      for (const r of rows) {
        const payload = { service_id: sid, hair_length: r.hair_length, price: r.price, duration_min: r.duration_min, unavailable: r.unavailable, promo_price: r.promo_price, promo_from: r.promo_from || null, promo_until: r.promo_until || null }
        const q = r.id ? await db().from('service_prices').update(payload).eq('id', r.id) : await db().from('service_prices').insert(payload)
        if (q.error) throw q.error
      }
      toast('Serviço salvo'); onSaved(); onClose()
    } catch (err) { toast(friendlyError(err), true) }
    setBusy(false)
  }

  async function remove() {
    if (!service || !confirm(`Excluir “${service.name}”? Agendamentos antigos continuam guardados. Se quiser apenas esconder do site, desmarque “Ativo”.`)) return
    const { error } = await db().from('services').delete().eq('id', service.id)
    if (error) return toast(friendlyError(error), true)
    toast('Serviço excluído'); onSaved(); onClose()
  }

  return (
    <Modal title={service ? service.name : 'Novo serviço'} onClose={onClose} wide>
      <form onSubmit={save} className="grid gap-5 sm:grid-cols-2">
        <Field label="Nome"><input className="field-box" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={80} /></Field>
        <Field label="Categoria"><input className="field-box" list="cats" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} maxLength={40} /><datalist id="cats"><option>Corte</option><option>Cor</option><option>Tratamento</option><option>Penteado</option><option>Noivas</option></datalist></Field>
        <Field label="Descrição" className="sm:col-span-2"><textarea rows={2} className="field-box" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={600} /></Field>
        <Field label="Duração padrão (min)"><input type="number" min={15} max={720} step={5} className="field-box" value={f.duration_min} onChange={(e) => setF({ ...f, duration_min: Number(e.target.value) })} /></Field>
        <Field label="Preço">
          <select className="field-box" value={f.price_mode} onChange={(e) => setF({ ...f, price_mode: e.target.value as PriceMode })}>
            <option value="unico">Preço único (qualquer cabelo)</option>
            <option value="por_comprimento">Varia pelo comprimento</option>
          </select>
        </Field>
        <Field label="Dias em que pode ser agendado" className="sm:col-span-2">
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS_SHORT.map((d, i) => {
              const on = f.allowed_weekdays.includes(i)
              return <button type="button" key={d} onClick={() => setF({ ...f, allowed_weekdays: on ? f.allowed_weekdays.filter((x) => x !== i) : [...f.allowed_weekdays, i] })} className={`chip transition ${on ? 'border-espresso bg-espresso text-marfim' : 'hover:border-espresso'}`}>{d}</button>
            })}
          </div>
        </Field>
        <Field label="Quem faz este serviço" className="sm:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            {staff.map((st) => {
              const all = !f.staff_only || f.staff_only.length === 0
              const on = all || f.staff_only!.includes(st.id)
              const toggle = () => {
                const cur = all ? staff.map((x) => x.id) : f.staff_only!
                const next = on ? cur.filter((x) => x !== st.id) : [...cur, st.id]
                setF({ ...f, staff_only: next.length === staff.length ? null : next })
              }
              return <button type="button" key={st.id} onClick={toggle} className={`chip transition ${on ? 'border-espresso bg-espresso text-marfim' : 'hover:border-espresso'}`}>{st.name}</button>
            })}
            <span className="text-xs text-espresso/50">{!f.staff_only ? 'Todas fazem' : 'Só as marcadas — nunca dois ao mesmo tempo além delas'}</span>
          </div>
        </Field>
        <Field label="Começar a partir de (opcional)"><input type="time" className="field-box" value={f.start_window_from} onChange={(e) => setF({ ...f, start_window_from: e.target.value })} /></Field>
        <Field label="Último início (opcional)"><input type="time" className="field-box" value={f.start_window_to} onChange={(e) => setF({ ...f, start_window_to: e.target.value })} /></Field>

        <div className="sm:col-span-2">
          <span className="label">Valores {f.price_mode === 'por_comprimento' && '— deixe em branco para “valor confirmado no salão”'}</span>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="text-left text-[0.65rem] uppercase tracking-[0.14em] text-espresso/50">
                <th className="py-2 pr-2">Comprimento</th><th className="pr-2">Preço R$</th><th className="pr-2">Duração</th><th className="pr-2">Promo R$</th><th className="pr-2">Promo de</th><th className="pr-2">até</th><th>Indisp.</th>
              </tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={`border-t border-espresso/10 ${r.unavailable ? 'opacity-50' : ''}`}>
                    <td className="py-2 pr-2">{r.hair_length ? HAIR_LENGTHS.find((h) => h.value === r.hair_length)?.label : 'Todos'}</td>
                    <td className="pr-2"><input inputMode="decimal" className="field-box !py-1.5" value={r.price ?? ''} onChange={(e) => setRow(i, { price: num(e.target.value) })} /></td>
                    <td className="pr-2"><input type="number" min={15} step={5} className="field-box !py-1.5" placeholder={String(f.duration_min)} value={r.duration_min ?? ''} onChange={(e) => setRow(i, { duration_min: num(e.target.value) })} /></td>
                    <td className="pr-2"><input inputMode="decimal" className="field-box !py-1.5" value={r.promo_price ?? ''} onChange={(e) => setRow(i, { promo_price: num(e.target.value) })} /></td>
                    <td className="pr-2"><input type="date" className="field-box !py-1.5" value={r.promo_from ?? ''} onChange={(e) => setRow(i, { promo_from: e.target.value || null })} /></td>
                    <td className="pr-2"><input type="date" className="field-box !py-1.5" value={r.promo_until ?? ''} onChange={(e) => setRow(i, { promo_until: e.target.value || null })} /></td>
                    <td className="text-center"><input type="checkbox" className="accent-[#2b1f19]" checked={r.unavailable} onChange={(e) => setRow(i, { unavailable: e.target.checked })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-espresso/50">Promoção: preencha o preço promocional e o período. Fora do período, volta o preço normal automaticamente.</p>
        </div>

        <div className="flex flex-wrap gap-6 sm:col-span-2">
          {([['active', 'Ativo (aparece no site)'], ['bookable_online', 'Agendamento online'], ['featured', 'Destaque']] as const).map(([k, l]) => (
            <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[#2b1f19]" checked={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} /> {l}</label>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 sm:col-span-2">
          <div className="flex gap-3"><button disabled={busy} className="btn-dark">{busy ? 'Salvando…' : 'Salvar'}</button><button type="button" onClick={onClose} className="btn-line">Cancelar</button></div>
          {service && <button type="button" onClick={remove} className="btn-ghost !text-erro decoration-erro/40">Excluir serviço</button>}
        </div>
      </form>
    </Modal>
  )
}

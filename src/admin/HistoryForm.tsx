import { useState } from 'react'
import { db, friendlyError } from '../lib/supabase'
import { HAIR_LENGTHS, dateSP, todaySP } from '../lib/format'
import type { Appointment, HairLength, HistoryEntry } from '../lib/types'
import { Field, SignedImg, toast, uploadImage } from './ui'
import { Close, Plus } from '../components/Icons'

export function HistoryForm({ clientId, entry, fromAppointment, onSaved, onCancel }:
  { clientId: string; entry?: HistoryEntry | null; fromAppointment?: Appointment | null; onSaved: () => void; onCancel: () => void }) {
  const [f, setF] = useState({
    performed_on: entry?.performed_on ?? (fromAppointment ? dateSP(fromAppointment.starts_at) : todaySP()),
    service_name: entry?.service_name ?? fromAppointment?.service_name ?? '',
    hair_length: (entry?.hair_length ?? fromAppointment?.hair_length ?? '') as HairLength | '',
    price: entry?.price != null ? String(entry.price) : fromAppointment?.price != null ? String(fromAppointment.price) : '',
    formula: entry?.formula ?? '',
    products: entry?.products ?? '',
    internal_notes: entry?.internal_notes ?? '',
    client_notes: entry?.client_notes ?? '',
  })
  const [photos, setPhotos] = useState<string[]>(entry?.photo_paths ?? [])
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    try {
      const paths: string[] = []
      for (const file of Array.from(files).slice(0, 6)) paths.push(await uploadImage('clientes', clientId, file))
      setPhotos((p) => [...p, ...paths])
    } catch (e) { toast(friendlyError(e) === 'Algo não saiu como esperado. Tente novamente.' ? (e as Error).message : friendlyError(e), true) }
    setBusy(false)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (f.service_name.trim().length < 2) return toast('Informe o procedimento', true)
    setBusy(true)
    const row = {
      client_id: clientId,
      appointment_id: entry?.appointment_id ?? fromAppointment?.id ?? null,
      performed_on: f.performed_on,
      service_name: f.service_name.trim(),
      hair_length: f.hair_length || null,
      price: f.price === '' ? null : Number(f.price.replace(',', '.')),
      formula: f.formula || null,
      products: f.products || null,
      internal_notes: f.internal_notes || null,
      client_notes: f.client_notes || null,
      photo_paths: photos,
    }
    const { error } = entry
      ? await db().from('service_history').update(row).eq('id', entry.id)
      : await db().from('service_history').insert(row)
    setBusy(false)
    if (error) return toast(friendlyError(error), true)
    const removed = (entry?.photo_paths ?? []).filter((p) => !photos.includes(p))
    if (removed.length) await db().storage.from('clientes').remove(removed)
    onSaved()
  }

  return (
    <form onSubmit={save} className="grid gap-5 sm:grid-cols-2">
      <Field label="Procedimento"><input className="field-box" value={f.service_name} onChange={set('service_name')} placeholder="Ex.: Luzes + tonalização" maxLength={120} /></Field>
      <Field label="Data"><input type="date" className="field-box" value={f.performed_on} onChange={set('performed_on')} /></Field>
      <Field label="Comprimento">
        <select className="field-box" value={f.hair_length} onChange={set('hair_length')}><option value="">—</option>{HAIR_LENGTHS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</select>
      </Field>
      <Field label="Valor cobrado (R$)"><input inputMode="decimal" className="field-box" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value.replace(/[^\d.,]/g, '') })} /></Field>
      <Field label="Fórmula / cores (interno)" className="sm:col-span-2"><textarea rows={2} className="field-box" value={f.formula} onChange={set('formula')} placeholder="Ex.: pó descolorante + 30 vol; tonalizante 9.1 + 9.2" /></Field>
      <Field label="Produtos utilizados (interno)" className="sm:col-span-2"><textarea rows={2} className="field-box" value={f.products} onChange={set('products')} /></Field>
      <Field label="Anotações internas" className="sm:col-span-2"><textarea rows={2} className="field-box" value={f.internal_notes} onChange={set('internal_notes')} /></Field>
      <Field label="Recado para a cliente (ela vê no histórico)" className="sm:col-span-2"><textarea rows={2} className="field-box" value={f.client_notes} onChange={set('client_notes')} placeholder="Ex.: hidratar 1x por semana, voltar em 45 dias" /></Field>
      <div className="sm:col-span-2">
        <span className="label">Fotos (antes / depois) — privadas</span>
        <div className="mt-2 flex flex-wrap gap-3">
          {photos.map((p) => (
            <div key={p} className="relative h-24 w-24">
              <SignedImg path={p} alt="Foto do procedimento" className="h-24 w-24" />
              <button type="button" onClick={() => setPhotos(photos.filter((x) => x !== p))} className="absolute -right-2 -top-2 rounded-full bg-espresso p-2 text-marfim" aria-label="Remover foto"><Close width={14} height={14} /></button>
            </div>
          ))}
          <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center border border-dashed border-espresso/30 text-xs text-espresso/55 hover:border-espresso">
            <Plus /> Adicionar
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => addPhotos(e.target.files)} />
          </label>
        </div>
      </div>
      <div className="flex gap-3 sm:col-span-2">
        <button disabled={busy} className="btn-dark">{busy ? 'Salvando…' : 'Salvar procedimento'}</button>
        <button type="button" onClick={onCancel} className="btn-line">Cancelar</button>
      </div>
    </form>
  )
}

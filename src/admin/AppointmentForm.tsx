import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { db, friendlyError } from '../lib/supabase'
import { HAIR_LENGTHS, STATUS_LABEL, dateSP, effectivePrice, maskPhone, money, priceFor, spToIso, timeSP, todaySP } from '../lib/format'
import type { Appointment, AppointmentStatus, Client, HairLength, Service } from '../lib/types'
import { Field, Modal, toast } from './ui'
import { HistoryForm } from './HistoryForm'
import { useStaff } from './useStaff'
import { sendInvite } from './invite'
import { waClient } from '../lib/whatsapp'
import { Whats } from '../components/Icons'

export function useAllServices() {
  const [list, setList] = useState<Service[]>([])
  useEffect(() => {
    db().from('services').select('*, service_prices(*)').order('sort_order').then(({ data }) => setList((data as Service[]) ?? []))
  }, [])
  return list
}

type PickedClient = Pick<Client, 'id' | 'full_name'> & Partial<Client>

function ClientPicker({ value, onChange }: { value: PickedClient | null; onChange: (c: PickedClient | null) => void }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState<Client[]>([])
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  useEffect(() => {
    if (q.trim().length < 2) { setRes([]); return }
    const id = setTimeout(async () => {
      const term = q.trim().replace(/[%,()]/g, '')
      const digits = term.replace(/\D/g, '')
      let query = db().from('clients').select('*').order('full_name').limit(8)
      query = digits.length >= 4 ? query.or(`full_name.ilike.%${term}%,phone.ilike.%${digits.slice(-4)}%`) : query.ilike('full_name', `%${term}%`)
      const { data } = await query
      setRes((data as Client[]) ?? [])
    }, 250)
    return () => clearTimeout(id)
  }, [q])

  async function create() {
    if (name.trim().length < 2) return toast('Informe o nome', true)
    if (phone.replace(/\D/g, '').length < 10) return toast('Informe o celular com DDD', true)
    const { data, error } = await db().from('clients').insert({ full_name: name.trim(), phone }).select().single()
    if (error) return toast(friendlyError(error), true)
    onChange(data as Client); setCreating(false)
    toast('Cadastrada! Envie o convite para ela confirmar.')
  }

  if (value) return (
    <div className="border border-espresso/20 bg-white/70">
      <div className="flex min-h-12 items-center justify-between px-3">
        <span>{value.full_name}{value.phone && <span className="ml-2 text-[0.85rem] text-espresso/55">{value.phone}</span>}</span>
        <button type="button" onClick={() => onChange(null)} className="min-h-11 px-2 text-[0.85rem] underline">trocar</button>
      </div>
      {value.id && value.confirmed_at === null && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-espresso/10 bg-areia/40 px-3 py-2 text-[0.85rem]">
          <span>Aguardando a cliente confirmar o cadastro.</span>
          <button type="button" onClick={() => sendInvite(value as Client).catch((e) => toast(friendlyError(e) === 'Algo não saiu como esperado. Tente novamente.' ? e.message : friendlyError(e), true))} className="inline-flex min-h-10 items-center gap-1 underline"><Whats width={16} /> Enviar convite</button>
        </div>
      )}
    </div>
  )
  if (creating) return (
    <div className="space-y-3 border border-espresso/15 p-3">
      <input className="field-box" placeholder="Nome completo" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="field-box" placeholder="Telefone" inputMode="tel" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} />
      <div className="flex gap-3"><button type="button" onClick={create} className="btn-dark !py-2.5">Cadastrar</button><button type="button" onClick={() => setCreating(false)} className="btn-ghost">Cancelar</button></div>
    </div>
  )
  return (
    <div className="relative">
      <input className="field-box" placeholder="Buscar por nome ou telefone…" value={q} onChange={(e) => setQ(e.target.value)} />
      {(res.length > 0 || q.length >= 2) && (
        <ul className="absolute inset-x-0 top-full z-10 max-h-60 overflow-y-auto border border-espresso/20 bg-white shadow-lg">
          {res.map((c) => <li key={c.id}><button type="button" onClick={() => onChange(c)} className="block w-full px-3 py-2 text-left hover:bg-linho">{c.full_name} <span className="text-xs text-espresso/50">{c.phone}</span></button></li>)}
          <li><button type="button" onClick={() => { setCreating(true); setName(q) }} className="block w-full border-t border-espresso/10 px-3 py-2 text-left text-sm font-semibold text-cacau hover:bg-linho">+ Cadastrar nova cliente “{q}”</button></li>
        </ul>
      )}
      {q.length < 2 && <button type="button" onClick={() => setCreating(true)} className="mt-2 text-xs underline">+ nova cliente</button>}
    </div>
  )
}

const CUSTOM = '__custom__'

/** Criar ou editar um agendamento (a Laís pode marcar qualquer coisa, inclusive fora da lista). */
export function AppointmentForm({ appt, initialClient, initialDate, onClose, onSaved }:
  { appt?: Appointment | null; initialClient?: Pick<Client, 'id' | 'full_name'> | null; initialDate?: string; onClose: () => void; onSaved: () => void }) {
  const services = useAllServices()
  const editing = Boolean(appt)
  const [client, setClient] = useState<PickedClient | null>(appt?.clients ?? initialClient ?? null)
  const [serviceId, setServiceId] = useState<string>(appt ? appt.service_id ?? CUSTOM : '')
  const [customName, setCustomName] = useState(appt && !appt.service_id ? appt.service_name : '')
  const [length, setLength] = useState<HairLength | ''>(appt?.hair_length ?? '')
  const [date, setDate] = useState(appt ? dateSP(appt.starts_at) : initialDate ?? todaySP())
  const [time, setTime] = useState(appt ? timeSP(appt.starts_at) : '09:00')
  const [duration, setDuration] = useState(appt ? Math.round((+new Date(appt.ends_at) - +new Date(appt.starts_at)) / 60000) : 60)
  const [price, setPrice] = useState<string>(appt?.price != null ? String(appt.price) : '')
  const [status, setStatus] = useState<AppointmentStatus>(appt?.status ?? 'confirmado')
  const [staffId, setStaffId] = useState<string>(appt?.staff_id ?? '')
  const { staff } = useStaff()
  const [adminNote, setAdminNote] = useState(appt?.admin_note ?? '')
  const [busy, setBusy] = useState(false)
  const [conflicts, setConflicts] = useState<string[]>([])
  const [historyFor, setHistoryFor] = useState<Appointment | null>(null)

  const service = services.find((s) => s.id === serviceId)

  // ao escolher serviço/comprimento, sugere duração e preço
  useEffect(() => {
    if (!service || (editing && service.id === appt?.service_id && length === (appt?.hair_length ?? ''))) return
    const p = priceFor(service, (length || null) as HairLength | null)
    setDuration(p?.duration_min ?? service.duration_min)
    const v = p ? effectivePrice(p, date) : null
    setPrice(v != null ? String(v) : '')
  }, [serviceId, length]) // eslint-disable-line react-hooks/exhaustive-deps

  const startIso = useMemo(() => (date && time ? spToIso(date, time) : null), [date, time])
  useEffect(() => {
    if (!startIso) return
    const end = new Date(+new Date(startIso) + duration * 60000).toISOString()
    let q = db().from('appointments').select('id, starts_at, clients(full_name)').in('status', ['pendente', 'confirmado']).lt('starts_at', end).gt('ends_at', startIso)
    if (appt) q = q.neq('id', appt.id)
    q.then(({ data }) => setConflicts(((data ?? []) as unknown as { starts_at: string; clients: { full_name: string } | null }[]).map((c) => `${timeSP(c.starts_at)} ${c.clients?.full_name ?? ''}`)))
  }, [startIso, duration, appt])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!client) return toast('Escolha a cliente', true)
    const name = serviceId === CUSTOM ? customName.trim() : service?.name
    if (!name || name.length < 2) return toast('Informe o procedimento', true)
    if (!startIso) return toast('Informe data e horário', true)
    setBusy(true)
    const row = {
      client_id: client.id,
      service_id: serviceId === CUSTOM ? null : serviceId,
      service_name: name,
      hair_length: length || null,
      staff_id: staffId || null,
      starts_at: startIso,
      ends_at: new Date(+new Date(startIso) + duration * 60000).toISOString(),
      status,
      price: price === '' ? null : Number(price.replace(',', '.')),
      price_note: price === '' ? 'Valor a definir' : null,
      admin_note: adminNote || null,
    }
    const res = editing
      ? await db().from('appointments').update(row).eq('id', appt!.id).select('*, clients(id, full_name, phone)').single()
      : await db().from('appointments').insert(row).select('*, clients(id, full_name, phone)').single()
    setBusy(false)
    if (res.error) return toast(friendlyError(res.error), true)
    toast(editing ? 'Agendamento atualizado' : 'Agendamento criado')
    onSaved()
    if (status === 'concluido' && appt?.status !== 'concluido') setHistoryFor(res.data as Appointment)
    else onClose()
  }

  async function remove() {
    if (!appt || !confirm('Excluir este agendamento definitivamente? (Para manter o registro, prefira “Cancelado”.)')) return
    const { error } = await db().from('appointments').delete().eq('id', appt.id)
    if (error) return toast(friendlyError(error), true)
    toast('Agendamento excluído'); onSaved(); onClose()
  }

  if (historyFor) return (
    <Modal title="Registrar procedimento realizado" onClose={onClose} wide>
      <p className="mb-6 text-sm text-espresso/60">O atendimento foi concluído. Quer registrar o que foi feito na ficha da cliente? (fórmula, produtos, fotos…)</p>
      <HistoryForm clientId={historyFor.client_id} fromAppointment={historyFor} onSaved={() => { toast('Procedimento registrado na ficha'); onClose() }} onCancel={onClose} />
    </Modal>
  )

  return (
    <Modal title={editing ? 'Agendamento' : 'Novo agendamento'} onClose={onClose} wide>
      <form onSubmit={save} className="grid gap-5 sm:grid-cols-2">
        <Field label="Cliente" className="sm:col-span-2">
          <ClientPicker value={client} onChange={setClient} />
          {client && editing && <Link to={`/admin/clientes/${client.id}`} className="mt-1 inline-block text-xs underline">abrir ficha da cliente</Link>}
        </Field>
        <Field label="Procedimento">
          <select className="field-box" value={serviceId} onChange={(e) => setServiceId(e.target.value)} required>
            <option value="" disabled>Escolha…</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}{!s.active ? ' (inativo)' : ''}</option>)}
            <option value={CUSTOM}>Outro (personalizado)…</option>
          </select>
        </Field>
        {serviceId === CUSTOM
          ? <Field label="Nome do procedimento"><input className="field-box" placeholder="Ex.: Corte sem escova" value={customName} onChange={(e) => setCustomName(e.target.value)} maxLength={120} /></Field>
          : <Field label="Comprimento">
              <select className="field-box" value={length} onChange={(e) => setLength(e.target.value as HairLength | '')} disabled={service?.price_mode === 'unico'}>
                <option value="">—</option>
                {HAIR_LENGTHS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </Field>}
        <Field label="Data"><input type="date" className="field-box" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
        <Field label="Horário"><input type="time" step={300} className="field-box" value={time} onChange={(e) => setTime(e.target.value)} required /></Field>
        <Field label="Duração (min)"><input type="number" min={15} max={720} step={5} className="field-box" value={duration} onChange={(e) => setDuration(Number(e.target.value))} /></Field>
        <Field label="Valor (R$)"><input inputMode="decimal" className="field-box" placeholder="a definir" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.,]/g, ''))} /></Field>
        <Field label="Atendente (opcional)" className="sm:col-span-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setStaffId('')} className={`chip transition ${!staffId ? 'border-espresso bg-espresso text-marfim' : 'hover:border-espresso'}`}>Qualquer</button>
            {staff.filter((s) => s.active || s.id === staffId).map((s) => {
              const notAllowed = service?.staff_only && !service.staff_only.includes(s.id)
              return <button type="button" key={s.id} disabled={!!notAllowed} onClick={() => setStaffId(s.id)} title={notAllowed ? 'Esta atendente não faz este serviço' : undefined} className={`chip transition disabled:opacity-30 ${staffId === s.id ? 'border-espresso bg-espresso text-marfim' : 'hover:border-espresso'}`}>{s.name}</button>
            })}
          </div>
        </Field>
        <Field label="Status" className="sm:col-span-2">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(STATUS_LABEL) as AppointmentStatus[]).map((s) => (
              <button type="button" key={s} onClick={() => setStatus(s)} className={`chip transition ${status === s ? 'border-espresso bg-espresso text-marfim' : 'hover:border-espresso'}`}>{STATUS_LABEL[s]}</button>
            ))}
          </div>
        </Field>
        {appt?.unverified && <div className="sm:col-span-2 border-l-4 border-erro/60 bg-erro/5 p-3 text-sm"><strong>Dados não conferem.</strong> A pessoa digitou o nome “{appt.guest_name}”. Confira pelo WhatsApp se é mesmo esta cliente.</div>}
        {appt?.client_note && <div className="sm:col-span-2 bg-linho p-3 text-sm"><span className="label">Observação da cliente</span>“{appt.client_note}”</div>}
        <Field label="Anotação interna (a cliente não vê)" className="sm:col-span-2"><textarea rows={2} className="field-box" value={adminNote} onChange={(e) => setAdminNote(e.target.value)} maxLength={2000} /></Field>
        {conflicts.length > 0 && <p className="sm:col-span-2 border-l-2 border-bronze bg-areia/40 px-3 py-2 text-sm">{conflicts.length >= Math.max(1, staff.filter((s) => s.active).length) ? 'Atenção: o horário já está cheio' : 'Neste horário também há'} — {conflicts.join(', ')}. Você pode salvar mesmo assim.</p>}
        <div className="flex flex-wrap items-center justify-between gap-4 sm:col-span-2">
          <div className="flex gap-3">
            <button disabled={busy} className="btn-dark">{busy ? 'Salvando…' : 'Salvar'}</button>
            <button type="button" onClick={onClose} className="btn-line">Fechar</button>
          </div>
          {editing && client?.phone && waClient(client.phone, '') && (
            <a href={waClient(client.phone, `Olá, ${client.full_name.split(' ')[0]}! Aqui é do Studio Lais Vettore. Seu horário: ${service?.name ?? customName}, ${date.split('-').reverse().join('/')} às ${time}.`)!} target="_blank" rel="noopener noreferrer" className="btn border border-espresso/25"><Whats /> Mandar no WhatsApp</a>
          )}
          {editing && <button type="button" onClick={remove} className="btn-ghost min-h-11 !text-erro decoration-erro/40">Excluir</button>}
        </div>
        {editing && price && <p className="text-xs text-espresso/45 sm:col-span-2">Valor atual: {money(Number(price.replace(',', '.')))}</p>}
      </form>
    </Modal>
  )
}

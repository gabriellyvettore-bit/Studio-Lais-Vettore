import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db, friendlyError } from '../lib/supabase'
import { HAIR_LENGTHS, STATUS_LABEL, STATUS_STYLE, dateSP, lengthLabel, maskPhone, money, onlyDigits, shortDate, timeSP } from '../lib/format'
import type { Appointment, Client, ClientRecord, HairLength, HistoryEntry } from '../lib/types'
import { AdminTitle, Field, Modal, SignedImg, toast, uploadImage } from './ui'
import { AppointmentForm } from './AppointmentForm'
import { HistoryForm } from './HistoryForm'
import { ArrowLeft, Edit, Plus, Trash, User, Whats } from '../components/Icons'
import { sendInvite } from './invite'

export default function Clientes() {
  const [q, setQ] = useState('')
  const [list, setList] = useState<Client[] | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const id = setTimeout(async () => {
      let query = db().from('clients').select('*').order('full_name').limit(200)
      const term = q.trim().replace(/[%,()]/g, '')
      if (term) {
        const d = onlyDigits(term)
        query = d.length >= 4 ? query.or(`full_name.ilike.%${term}%,phone.ilike.%${d.slice(-4)}%`) : query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`)
      }
      const { data, error } = await query
      if (error) toast(friendlyError(error), true)
      setList((data as Client[]) ?? [])
    }, 250)
    return () => clearTimeout(id)
  }, [q])

  return (
    <>
      <AdminTitle kicker="Fichas" title="Clientes" actions={<button onClick={() => setCreating(true)} className="btn-dark"><Plus /> Nova cliente</button>} />
      <input className="field-box max-w-md" placeholder="Buscar por nome, telefone ou e-mail…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar cliente" />
      {!list ? <p className="mt-6 text-espresso/50">Carregando…</p> : list.length === 0 ? <p className="mt-6 text-espresso/55">Nenhuma cliente encontrada.</p> : (
        <ul className="mt-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => (
            <li key={c.id}>
              <Link to={`/admin/clientes/${c.id}`} className="panel flex items-center gap-4 p-4 transition hover:border-espresso/40 hover:bg-white">
                <Avatar c={c} size="h-12 w-12" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-xl">{c.full_name}</span>
                  <span className="block truncate text-sm text-espresso/55">{c.phone ?? c.email ?? '—'}</span>
                </span>
                {!c.confirmed_at && <span className="chip shrink-0 border-bronze/50 !px-2 !text-[0.55rem] text-bronze-texto">aguardando</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {creating && <ClientEditModal onClose={() => setCreating(false)} />}
    </>
  )
}

function Avatar({ c, size }: { c: Pick<Client, 'photo_path' | 'full_name'>; size: string }) {
  if (c.photo_path) return <SignedImg path={c.photo_path} alt={c.full_name} className={`${size} shrink-0 rounded-full`} />
  return <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-areia font-display text-xl text-cacau`}>{c.full_name.slice(0, 1).toUpperCase()}</span>
}

function ClientEditModal({ client, onClose, onSaved }: { client?: Client; onClose: () => void; onSaved?: () => void }) {
  const nav = useNavigate()
  const [f, setF] = useState({ full_name: client?.full_name ?? '', phone: maskPhone(client?.phone ?? ''), email: client?.email ?? '', birth_date: client?.birth_date ?? '' })
  const [busy, setBusy] = useState(false)
  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (f.full_name.trim().length < 2) return toast('Informe o nome', true)
    if (f.phone.replace(/\D/g, '').length < 10) return toast('Informe o celular com DDD', true)
    setBusy(true)
    const row = { full_name: f.full_name.trim(), phone: f.phone || null, email: f.email || null, birth_date: f.birth_date || null }
    const res = client ? await db().from('clients').update(row).eq('id', client.id).select().single() : await db().from('clients').insert(row).select().single()
    setBusy(false)
    if (res.error) return toast(friendlyError(res.error), true)
    toast('Cliente salva'); onSaved?.(); onClose()
    if (!client) nav(`/admin/clientes/${(res.data as Client).id}`)
  }
  return (
    <Modal title={client ? 'Editar dados' : 'Nova cliente'} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Nome completo"><input className="field-box" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} maxLength={120} /></Field>
        <Field label="Telefone"><input className="field-box" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: maskPhone(e.target.value) })} /></Field>
        <Field label="E-mail"><input className="field-box" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Nascimento"><input className="field-box" type="date" value={f.birth_date} onChange={(e) => setF({ ...f, birth_date: e.target.value })} /></Field>
        <button disabled={busy} className="btn-dark">{busy ? 'Salvando…' : 'Salvar'}</button>
      </form>
    </Modal>
  )
}

export function ClienteDetalhe() {
  const { id } = useParams()
  const nav = useNavigate()
  const [c, setC] = useState<Client | null>(null)
  const [rec, setRec] = useState<ClientRecord | null>(null)
  const [hist, setHist] = useState<HistoryEntry[]>([])
  const [appts, setAppts] = useState<Appointment[]>([])
  const [editData, setEditData] = useState(false)
  const [histForm, setHistForm] = useState<HistoryEntry | 'new' | null>(null)
  const [apptForm, setApptForm] = useState<Appointment | 'new' | null>(null)
  const [merge, setMerge] = useState(false)

  async function load() {
    const [a, b, h, ap] = await Promise.all([
      db().from('clients').select('*').eq('id', id!).maybeSingle(),
      db().from('client_records').select('*').eq('client_id', id!).maybeSingle(),
      db().from('service_history').select('*').eq('client_id', id!).order('performed_on', { ascending: false }),
      db().from('appointments').select('*, clients(id, full_name, phone)').eq('client_id', id!).order('starts_at', { ascending: false }).limit(100),
    ])
    if (!a.data) { toast('Cliente não encontrada', true); nav('/admin/clientes'); return }
    setC(a.data as Client); setRec((b.data as ClientRecord) ?? null); setHist((h.data as HistoryEntry[]) ?? []); setAppts((ap.data as Appointment[]) ?? [])
  }
  useEffect(() => { void load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function photo(file: File | undefined) {
    if (!file || !c) return
    try {
      const path = await uploadImage('clientes', `${c.id}/perfil`, file)
      const old = c.photo_path
      const { error } = await db().from('clients').update({ photo_path: path }).eq('id', c.id)
      if (error) throw error
      if (old) await db().storage.from('clientes').remove([old])
      toast('Foto atualizada'); void load()
    } catch (e) { toast((e as Error).message || friendlyError(e), true) }
  }

  async function delHist(h: HistoryEntry) {
    if (!confirm(`Excluir o registro “${h.service_name}” de ${shortDate(h.performed_on)}?`)) return
    const { error } = await db().from('service_history').delete().eq('id', h.id)
    if (error) return toast(friendlyError(error), true)
    if (h.photo_paths.length) await db().storage.from('clientes').remove(h.photo_paths)
    toast('Registro excluído'); void load()
  }

  async function deleteClient() {
    if (!c || prompt(`Excluir ${c.full_name} e TODO o histórico? Digite EXCLUIR para confirmar.`)?.trim().toUpperCase() !== 'EXCLUIR') return
    const paths = [c.photo_path, ...hist.flatMap((h) => h.photo_paths)].filter(Boolean) as string[]
    const { error } = await db().from('clients').delete().eq('id', c.id)
    if (error) return toast(friendlyError(error), true)
    if (paths.length) await db().storage.from('clientes').remove(paths)
    toast('Cliente excluída'); nav('/admin/clientes')
  }

  if (!c) return <p className="text-espresso/50">Carregando…</p>
  const wa = onlyDigits(c.phone ?? '')

  return (
    <>
      <Link to="/admin/clientes" className="btn-ghost !text-[0.7rem]"><ArrowLeft /> Clientes</Link>
      <div className="mt-6 flex flex-wrap items-center gap-6">
        <label className="group relative cursor-pointer" title="Trocar foto">
          {c.photo_path ? <SignedImg path={c.photo_path} alt={c.full_name} className="h-24 w-24 rounded-full" /> : <span className="flex h-24 w-24 items-center justify-center rounded-full bg-areia text-cacau"><User width={32} height={32} /></span>}
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-espresso/60 text-xs text-marfim opacity-0 transition group-hover:opacity-100">Foto</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => photo(e.target.files?.[0])} />
        </label>
        <div className="min-w-0 flex-1">
          <h1 className="text-[clamp(2.2rem,4vw,3.4rem)] leading-none">{c.full_name}</h1>
          <p className="mt-2 text-sm text-espresso/60">{[c.phone, c.email, c.birth_date && `nasc. ${shortDate(c.birth_date)}`].filter(Boolean).join(' · ')}</p>
          <p className="mt-1 text-xs text-espresso/45">Cliente desde {shortDate(c.created_at.slice(0, 10))}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {wa.length >= 10 && <a href={`https://wa.me/55${wa.replace(/^55/, '')}`} target="_blank" rel="noopener noreferrer" className="btn-line !px-4"><Whats /> WhatsApp</a>}
          <button onClick={() => setEditData(true)} className="btn-line !px-4"><Edit /> Editar</button>
          <button onClick={() => setApptForm('new')} className="btn-dark !px-4"><Plus /> Agendar</button>
        </div>
      </div>

      {!c.confirmed_at && (
        <div className="mt-6 flex flex-col gap-3 border-l-4 border-bronze bg-areia/50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[0.95rem]"><strong>Aguardando {c.full_name.split(' ')[0]} confirmar o cadastro.</strong> Envie o convite: ela recebe um link no WhatsApp e confirma com um toque.</p>
          <button onClick={() => sendInvite(c).catch((e) => toast(e?.message ?? friendlyError(e), true))} className="btn-dark shrink-0"><Whats /> Enviar convite</button>
        </div>
      )}

      <div className="mt-8 grid gap-6 xl:grid-cols-12">
        <div className="space-y-8 xl:col-span-7">
          <section className="panel p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl">Procedimentos realizados</h2>
              <button onClick={() => setHistForm('new')} className="btn-dark !px-4 !py-2.5"><Plus /> Adicionar</button>
            </div>
            {hist.length === 0 ? <p className="mt-4 text-sm text-espresso/55">Nenhum procedimento registrado ainda.</p> : (
              <ol className="mt-6 space-y-6">
                {hist.map((h) => (
                  <li key={h.id} className="border-l-2 border-areia pl-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-cacau">{shortDate(h.performed_on)}</p>
                        <p className="font-display text-2xl">{h.service_name}</p>
                        <p className="text-sm text-espresso/55">{[lengthLabel(h.hair_length), money(h.price)].filter(Boolean).join(' · ')}</p>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => setHistForm(h)} className="p-2 hover:bg-linho" aria-label="Editar"><Edit /></button>
                        <button onClick={() => delHist(h)} className="p-2 text-erro hover:bg-linho" aria-label="Excluir"><Trash /></button>
                      </div>
                    </div>
                    <dl className="mt-3 grid gap-2 text-sm">
                      {h.formula && <div><dt className="label !mb-0">Fórmula</dt><dd className="whitespace-pre-wrap">{h.formula}</dd></div>}
                      {h.products && <div><dt className="label !mb-0">Produtos</dt><dd className="whitespace-pre-wrap">{h.products}</dd></div>}
                      {h.internal_notes && <div><dt className="label !mb-0">Interno</dt><dd className="whitespace-pre-wrap">{h.internal_notes}</dd></div>}
                      {h.client_notes && <div><dt className="label !mb-0">Recado à cliente</dt><dd className="italic">{h.client_notes}</dd></div>}
                    </dl>
                    {h.photo_paths.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{h.photo_paths.map((p) => <SignedImg key={p} path={p} alt="" className="h-28 w-24" />)}</div>}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="panel p-6">
            <h2 className="text-3xl">Agendamentos</h2>
            {appts.length === 0 ? <p className="mt-4 text-sm text-espresso/55">Nenhum agendamento.</p> : (
              <ul className="mt-4 divide-y divide-espresso/10">
                {appts.map((a) => (
                  <li key={a.id}><button onClick={() => setApptForm(a)} className="flex w-full flex-wrap items-center justify-between gap-2 py-3 text-left hover:bg-linho/50">
                    <span><span className="font-display text-xl">{a.service_name}</span> <span className="text-sm text-espresso/55">· {shortDate(dateSP(a.starts_at))} {timeSP(a.starts_at)}</span></span>
                    <span className={`chip !text-[0.6rem] ${STATUS_STYLE[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                  </button></li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-8 xl:col-span-5">
          <RecordForm clientId={c.id} rec={rec} onSaved={load} />
          <section className="panel space-y-3 p-6 text-sm">
            <h2 className="text-2xl">Cadastro</h2>
            <button onClick={() => setMerge(true)} className="btn-ghost min-h-11 !text-[0.7rem]">Unir com outro cadastro duplicado</button><br />
            {c.confirmed_at && <><button onClick={async () => {
              if (!confirm(`Resetar o acesso de ${c.full_name}? Os celulares lembrados saem e ela precisa confirmar de novo pelo convite.`)) return
              const { error } = await db().rpc('admin_reset_access', { p_client: c.id })
              if (error) return toast(friendlyError(error), true)
              toast('Acesso resetado. Envie o novo convite.'); void load()
            }} className="btn-ghost min-h-11 !text-[0.7rem]">Resetar acesso (uso indevido do celular)</button><br /></>}
            <button onClick={deleteClient} className="btn-ghost !text-[0.7rem] !text-erro decoration-erro/40">Excluir cliente e histórico</button>
          </section>
        </div>
      </div>

      {editData && <ClientEditModal client={c} onClose={() => setEditData(false)} onSaved={load} />}
      {histForm && (
        <Modal title={histForm === 'new' ? 'Novo procedimento' : 'Editar procedimento'} onClose={() => setHistForm(null)} wide>
          <HistoryForm clientId={c.id} entry={histForm === 'new' ? null : histForm} onSaved={() => { toast('Procedimento salvo'); setHistForm(null); void load() }} onCancel={() => setHistForm(null)} />
        </Modal>
      )}
      {apptForm && <AppointmentForm appt={apptForm === 'new' ? null : apptForm} initialClient={c} onClose={() => setApptForm(null)} onSaved={load} />}
      {merge && <MergeModal keep={c} onClose={() => setMerge(false)} onDone={load} />}
    </>
  )
}

function RecordForm({ clientId, rec, onSaved }: { clientId: string; rec: ClientRecord | null; onSaved: () => void }) {
  const [f, setF] = useState({ hair_type: '', hair_length: '' as HairLength | '', allergies: '', chemical_history: '', notes: '' })
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    setF({ hair_type: rec?.hair_type ?? '', hair_length: rec?.hair_length ?? '', allergies: rec?.allergies ?? '', chemical_history: rec?.chemical_history ?? '', notes: rec?.notes ?? '' })
  }, [rec])
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true)
    const { error } = await db().from('client_records').upsert({
      client_id: clientId, hair_type: f.hair_type || null, hair_length: f.hair_length || null,
      allergies: f.allergies || null, chemical_history: f.chemical_history || null, notes: f.notes || null,
    })
    setBusy(false)
    if (error) return toast(friendlyError(error), true)
    toast('Ficha técnica salva'); onSaved()
  }
  return (
    <form onSubmit={save} className="panel space-y-4 p-6">
      <h2 className="text-3xl">Ficha técnica</h2>
      <p className="-mt-2 text-xs text-espresso/50">Visível somente para você.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo de cabelo"><input className="field-box" value={f.hair_type} onChange={(e) => setF({ ...f, hair_type: e.target.value })} placeholder="Ex.: liso fino, poroso" /></Field>
        <Field label="Comprimento atual"><select className="field-box" value={f.hair_length} onChange={(e) => setF({ ...f, hair_length: e.target.value as HairLength | '' })}><option value="">—</option>{HAIR_LENGTHS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</select></Field>
      </div>
      <Field label="Alergias / sensibilidades"><textarea rows={2} className="field-box" value={f.allergies} onChange={(e) => setF({ ...f, allergies: e.target.value })} /></Field>
      <Field label="Histórico químico"><textarea rows={3} className="field-box" value={f.chemical_history} onChange={(e) => setF({ ...f, chemical_history: e.target.value })} placeholder="Ex.: progressiva em 03/2026, henna…" /></Field>
      <Field label="Observações"><textarea rows={3} className="field-box" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      <button disabled={busy} className="btn-dark">{busy ? 'Salvando…' : 'Salvar ficha'}</button>
    </form>
  )
}

function MergeModal({ keep, onClose, onDone }: { keep: Client; onClose: () => void; onDone: () => void }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState<Client[]>([])
  useEffect(() => {
    const term = q.trim().replace(/[%,()]/g, '')
    if (term.length < 2) { setRes([]); return }
    db().from('clients').select('*').ilike('full_name', `%${term}%`).neq('id', keep.id).limit(8).then(({ data }) => setRes((data as Client[]) ?? []))
  }, [q, keep.id])
  async function merge(other: Client) {
    if (!confirm(`Unir “${other.full_name}” dentro de “${keep.full_name}”? Agendamentos e histórico serão movidos e o cadastro duplicado será apagado.`)) return
    const { error } = await db().rpc('admin_merge_clients', { p_keep: keep.id, p_remove: other.id })
    if (error) return toast(friendlyError(error), true)
    toast('Cadastros unidos'); onDone(); onClose()
  }
  return (
    <Modal title="Unir cadastros" onClose={onClose}>
      <p className="mb-4 text-sm text-espresso/60">Use quando a mesma cliente tem dois cadastros (ex.: você cadastrou pelo WhatsApp e depois ela criou conta no site).</p>
      <input className="field-box" placeholder="Buscar o cadastro duplicado…" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="mt-3 divide-y divide-espresso/10">{res.map((r) => <li key={r.id} className="flex items-center justify-between py-2"><span>{r.full_name} <span className="text-xs text-espresso/50">{r.phone}</span></span><button onClick={() => merge(r)} className="btn-line !px-3 !py-2">Unir</button></li>)}</ul>
    </Modal>
  )
}

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Close } from '../components/Icons'
import { db } from '../lib/supabase'

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', on)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', on); document.body.style.overflow = '' }
  }, [onClose])
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-espresso/40 backdrop-blur-[2px] sm:items-center sm:p-6" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}
        className={`max-h-[92dvh] w-full overflow-y-auto bg-marfim shadow-2xl [animation:fade_.3s_ease] ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-espresso/10 bg-marfim px-6 py-4">
          <h2 className="text-2xl">{title}</h2>
          <button onClick={onClose} aria-label="Fechar" className="-mr-3 flex h-11 w-11 items-center justify-center"><Close width={22} height={22} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className="label">{label}</span>{children}</label>
}

export function AdminTitle({ kicker, title, actions }: { kicker: ReactNode; title: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 lg:mb-8">
      <div><p className="kicker">{kicker}</p><h1 className="mt-1 text-[clamp(2rem,4vw,3.2rem)] leading-none">{title}</h1></div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  )
}

let toastSet: ((t: { msg: string; err?: boolean } | null) => void) | null = null
export function toast(msg: string, err = false) { toastSet?.({ msg, err }) }
export function Toaster() {
  const [t, setT] = useState<{ msg: string; err?: boolean } | null>(null)
  useEffect(() => { toastSet = setT; return () => { toastSet = null } }, [])
  useEffect(() => { if (!t) return; const id = setTimeout(() => setT(null), 3200); return () => clearTimeout(id) }, [t])
  if (!t) return null
  return <div role="status" className={`fixed bottom-24 lg:bottom-6 left-1/2 z-[90] -translate-x-1/2 px-5 py-3 text-sm shadow-xl [animation:fade_.3s_ease] ${t.err ? 'bg-erro text-marfim' : 'bg-espresso text-marfim'}`}>{t.msg}</div>
}

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']

/** Reduz a imagem no navegador antes de enviar (máx. 1600px, WebP). */
export async function compressImage(file: File, max = 1600): Promise<Blob> {
  if (!ALLOWED.includes(file.type)) throw new Error('Envie uma imagem JPG, PNG ou WebP.')
  if (file.size > 25 * 1024 * 1024) throw new Error('Imagem muito grande (máx. 25 MB).')
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Falha ao processar imagem'))), 'image/webp', 0.82))
}

export async function uploadImage(bucket: 'galeria' | 'clientes', folder: string, file: File) {
  const blob = await compressImage(file)
  const path = `${folder}/${crypto.randomUUID()}.webp`
  const { error } = await db().storage.from(bucket).upload(path, blob, { contentType: 'image/webp', upsert: false })
  if (error) throw error
  return path
}

/** URL temporária (10 min) para fotos privadas das clientes */
export function useSignedUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!path) { setUrl(null); return }
    let alive = true
    db().storage.from('clientes').createSignedUrl(path, 600).then(({ data }) => alive && setUrl(data?.signedUrl ?? null))
    return () => { alive = false }
  }, [path])
  return url
}

export function SignedImg({ path, alt, className = '' }: { path: string; alt: string; className?: string }) {
  const url = useSignedUrl(path)
  return url ? <img src={url} alt={alt} className={`object-cover ${className}`} /> : <div className={`animate-pulse bg-areia/60 ${className}`} />
}

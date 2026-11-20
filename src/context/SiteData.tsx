import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { DEFAULT_GALLERY, DEFAULT_SERVICES, DEFAULT_SETTINGS } from '../lib/defaults'
import type { GalleryItem, Service, SiteSettings } from '../lib/types'

interface SiteData {
  services: Service[]
  settings: SiteSettings
  gallery: GalleryItem[]
  loading: boolean
  live: boolean // dados vindos do banco
  reload: () => Promise<void>
}

const Ctx = createContext<SiteData | null>(null)

export function SiteDataProvider({ children }: { children: ReactNode }) {
  const [services, setServices] = useState<Service[]>(DEFAULT_SERVICES)
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS)
  const [gallery, setGallery] = useState<GalleryItem[]>(DEFAULT_GALLERY)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [live, setLive] = useState(false)

  const reload = useCallback(async () => {
    if (!supabase) return
    try {
      const [s, st, g] = await Promise.all([
        supabase.from('services').select('*, service_prices(*)').eq('active', true).order('sort_order'),
        supabase.from('site_settings').select('key, value'),
        supabase.from('gallery_items').select('*').eq('active', true).order('sort_order'),
      ])
      if (s.error || st.error || g.error) throw s.error ?? st.error ?? g.error
      setServices((s.data as Service[]) ?? [])
      const map = Object.fromEntries((st.data ?? []).map((r) => [r.key, r.value]))
      setSettings({
        contact: { ...DEFAULT_SETTINGS.contact, ...(map.contact ?? {}) },
        home: { ...DEFAULT_SETTINGS.home, ...(map.home ?? {}) },
        booking: { ...DEFAULT_SETTINGS.booking, ...(map.booking ?? {}) },
      })
      setGallery((g.data as GalleryItem[]) ?? [])
      setLive(true)
    } catch (e) {
      console.warn('Usando conteúdo de reserva:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  return <Ctx.Provider value={{ services, settings, gallery, loading, live, reload }}>{children}</Ctx.Provider>
}

export function useSiteData() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSiteData fora do provider')
  return v
}

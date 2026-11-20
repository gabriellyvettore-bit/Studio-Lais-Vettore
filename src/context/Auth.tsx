import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface Profile {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  birth_date: string | null
  lgpd_consent_at: string | null
}

interface Who { is_admin_account: boolean; aal: 'aal1' | 'aal2' }

interface AuthState {
  session: Session | null
  profile: Profile | null
  who: Who | null
  ready: boolean
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)
const RETURN_KEY = 'slv:return-to'

export const rememberReturn = (path: string) => sessionStorage.setItem(RETURN_KEY, path)
export const takeReturn = () => {
  const p = sessionStorage.getItem(RETURN_KEY)
  sessionStorage.removeItem(RETURN_KEY)
  return p
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [who, setWho] = useState<Who | null>(null)
  const [ready, setReady] = useState(!supabase)

  const load = useCallback(async (s: Session | null) => {
    if (!supabase || !s) { setProfile(null); setWho(null); return }
    const [p, w] = await Promise.all([supabase.rpc('get_my_profile'), supabase.rpc('whoami')])
    setProfile((p.data as Profile | null) ?? null)
    setWho((w.data as Who | null) ?? null)
  }, [])

  useEffect(() => {
    if (!supabase) return
    let alive = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return
      setSession(data.session)
      await load(data.session)
      setReady(true)
      // limpa ?code= da URL depois do login
      if (window.location.search.includes('code=')) {
        window.history.replaceState(null, '', window.location.pathname + window.location.hash)
      }
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      // adia para fora do callback (recomendação do supabase-js)
      setTimeout(() => { void load(s) }, 0)
    })
    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [load])

  const refresh = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase.auth.getSession()
    setSession(data.session)
    await load(data.session)
  }, [load])

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut()
    setSession(null); setProfile(null); setWho(null)
  }, [])

  return <Ctx.Provider value={{ session, profile, who, ready, refresh, signOut }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth fora do provider')
  return v
}

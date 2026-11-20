// Login só para a administração do studio (Google). Clientes não fazem login.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface Who { is_admin_account: boolean }

interface AuthState {
  session: Session | null
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
  const [who, setWho] = useState<Who | null>(null)
  const [ready, setReady] = useState(!supabase)

  const load = useCallback(async (s: Session | null) => {
    if (!supabase || !s) { setWho(null); return }
    const w = await supabase.rpc('whoami')
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
      if (window.location.search.includes('code=')) {
        window.history.replaceState(null, '', window.location.pathname + window.location.hash)
      }
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
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
    setSession(null); setWho(null)
  }, [])

  return <Ctx.Provider value={{ session, who, ready, refresh, signOut }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth fora do provider')
  return v
}

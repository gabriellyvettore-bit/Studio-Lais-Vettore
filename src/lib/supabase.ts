import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** true quando o site está ligado ao banco (variáveis definidas no build). */
export const isConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = isConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        flowType: 'pkce', // retorna ?code= (compatível com HashRouter)
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

export function db(): SupabaseClient {
  if (!supabase) throw new Error('Banco de dados ainda não configurado.')
  return supabase
}

/** URL pública de uma imagem: absoluta, do Storage ou arquivo do próprio site. */
export function assetUrl(path: string): string {
  if (/^https?:\/\//.test(path) || path.startsWith('data:') || path.startsWith('blob:')) return path
  return import.meta.env.BASE_URL + path.replace(/^\//, '')
}

/** Mensagens amigáveis para erros vindos das funções do banco. */
const ERRORS: Record<string, string> = {
  not_authenticated: 'Entre na sua conta para continuar.',
  profile_required: 'Complete seu cadastro antes de agendar.',
  too_many_pending: 'Você já tem agendamentos aguardando aprovação. Aguarde a confirmação ou fale com a gente.',
  service_unavailable: 'Este serviço não está disponível para agendamento online.',
  slot_unavailable: 'Esse horário acabou de ser ocupado. Escolha outro, por favor.',
  not_cancellable: 'Este agendamento não pode mais ser cancelado.',
  too_late_to_cancel: 'O prazo para cancelar online já passou. Fale com a gente pelo WhatsApp.',
  consent_required: 'É preciso aceitar a Política de Privacidade.',
  invalid_name: 'Informe seu nome completo.',
  invalid_phone: 'Informe um telefone com DDD.',
  forbidden: 'Acesso negado.',
}

export function friendlyError(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e)
  for (const k of Object.keys(ERRORS)) if (msg.includes(k)) return ERRORS[k]
  if (/row-level security|permission denied/i.test(msg)) return 'Você não tem permissão para esta ação.'
  if (/network|fetch/i.test(msg)) return 'Sem conexão. Verifique sua internet e tente de novo.'
  return 'Algo não saiu como esperado. Tente novamente.'
}

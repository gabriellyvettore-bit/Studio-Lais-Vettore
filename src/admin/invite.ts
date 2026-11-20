import { db } from '../lib/supabase'
import { waClient } from '../lib/whatsapp'
import type { Client } from '../lib/types'

type InviteClient = Pick<Client, 'id' | 'full_name' | 'phone' | 'invite_token' | 'invite_expires_at' | 'confirmed_at'>

/** Abre o WhatsApp da cliente com o link para ela confirmar o próprio cadastro. */
export async function sendInvite(c: InviteClient) {
  let token = c.invite_token
  if (!token || (c.invite_expires_at && new Date(c.invite_expires_at) < new Date())) {
    const { data, error } = await db().rpc('admin_new_invite', { p_client: c.id })
    if (error) throw error
    token = data as string
  }
  const link = `${window.location.origin}${import.meta.env.BASE_URL}#/confirmar/${token}`
  const wa = waClient(c.phone, `Olá, ${c.full_name.split(' ')[0]}! Aqui é do Studio Lais Vettore. Fizemos seu cadastro para você agendar com a gente. Para confirmar, é só tocar no link: ${link}`)
  if (!wa) throw new Error('Cadastre o celular da cliente para enviar o convite.')
  window.location.href = wa
}

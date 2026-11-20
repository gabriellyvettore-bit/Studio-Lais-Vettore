import type { ContactSettings } from './types'
import { onlyDigits } from './format'

/** O campo WhatsApp aceita um número (com DDD) ou um link do WhatsApp Business
 *  (ex.: https://wa.me/message/XXXX). */
function waLink(raw: string): string | null {
  const v = (raw || '').trim()
  if (/^https?:/i.test(v)) {
    try {
      const u = new URL(v)
      return u.protocol === 'https:' && ['wa.me', 'api.whatsapp.com'].includes(u.hostname) && !u.username ? u.href : null
    } catch { return null }
  }
  const d = onlyDigits(v)
  const local = /^55\d{10,11}$/.test(d) ? d.slice(2) : d
  if (local.length === 10 || local.length === 11) return `https://wa.me/55${local}`
  return null
}

/** Link para conversar com o salão. Com número, já abre com a mensagem escrita;
 *  com link curto do WhatsApp Business, abre a conversa do studio. Sem WhatsApp
 *  configurado, leva ao Direct do Instagram. */
export function contactLink(c: ContactSettings, message = 'Olá! Vim pelo site do Studio Lais Vettore e gostaria de mais informações.') {
  const link = waLink(c.whatsapp)
  if (!link) return `https://ig.me/m/${c.instagram || 'studiolaisvettore'}`
  return /wa\.me\/\d+$/.test(link) ? `${link}?text=${encodeURIComponent(message)}` : link
}

export const hasWhatsapp = (c: ContactSettings) => waLink(c.whatsapp) !== null

/** Abre conversa no WhatsApp com uma cliente (número dela) já com a mensagem. */
export function waClient(phone: string | null | undefined, message: string) {
  const d = onlyDigits(phone || '')
  // mesma regra do banco: só tira o 55 se for código do país (12–13 dígitos)
  const local = /^55\d{10,11}$/.test(d) ? d.slice(2) : d
  if (local.length < 10 || local.length > 11) return null
  return `https://wa.me/55${local}?text=${encodeURIComponent(message)}`
}

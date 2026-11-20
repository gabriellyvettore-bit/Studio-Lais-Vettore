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
  if (d.length >= 10 && d.length <= 13) return `https://wa.me/${d.startsWith('55') ? d : `55${d}`}`
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

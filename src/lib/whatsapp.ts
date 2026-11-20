import type { ContactSettings } from './types'
import { onlyDigits } from './format'

/** Link para conversar com o salão. Usa o WhatsApp configurado no painel;
 *  se ainda não houver número, leva para o Instagram (Direct). */
export function contactLink(c: ContactSettings, message = 'Olá! Vim pelo site do Studio Lais Vettore e gostaria de mais informações.') {
  const digits = onlyDigits(c.whatsapp || '')
  if (digits.length >= 10) {
    const full = digits.startsWith('55') ? digits : `55${digits}`
    return `https://wa.me/${full}?text=${encodeURIComponent(message)}`
  }
  return `https://ig.me/m/${c.instagram || 'studiolaisvettore'}`
}

export const hasWhatsapp = (c: ContactSettings) => onlyDigits(c.whatsapp || '').length >= 10

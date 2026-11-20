// Conteúdo de reserva: usado enquanto o banco não está configurado ou se
// ele estiver fora do ar. Espelha supabase/migrations/*_seed.sql.
import type { GalleryItem, Service, SiteSettings, HairLength } from './types'

const lens: HairLength[] = ['curto', 'medio', 'longo', 'extra_longo']
let n = 0
const id = () => `local-${++n}`

function svc(
  name: string, description: string, category: string, mode: 'unico' | 'por_comprimento',
  duration: number, prices: (number | null | 'x')[], opts: Partial<Service> = {}, durations: (number | null)[] = [],
): Service {
  const sid = id()
  const service_prices = mode === 'unico'
    ? [{ id: id(), service_id: sid, hair_length: null, price: prices[0] as number, duration_min: null, unavailable: false, promo_price: null, promo_from: null, promo_until: null }]
    : lens.map((l, i) => ({
        id: id(), service_id: sid, hair_length: l,
        price: prices[i] === 'x' ? null : (prices[i] as number | null),
        duration_min: durations[i] ?? null, unavailable: prices[i] === 'x',
        promo_price: null, promo_from: null, promo_until: null,
      }))
  return {
    id: sid, name, description, category, price_mode: mode, duration_min: duration,
    allowed_weekdays: [2, 3, 4, 5, 6], start_window_from: null, start_window_to: null,
    staff_only: null, bookable_online: true, active: true, featured: false, sort_order: 0, service_prices, ...opts,
  }
}

export const DEFAULT_SERVICES: Service[] = [
  svc('Corte + Escova', 'Corte personalizado para o seu formato de rosto, finalizado com escova.', 'Corte', 'unico', 60, [120], { featured: true, sort_order: 10 }),
  svc('Coloração de Raiz', 'Retoque de raiz com coloração profissional, cobertura uniforme e brilho.', 'Cor', 'unico', 120, [160], { sort_order: 20 }),
  svc('Luzes / Mechas', 'Loiro construído sob medida — iluminado, natural e saudável. Nossa especialidade.', 'Cor', 'por_comprimento', 60, [500, null, null, null], { featured: true, sort_order: 30, allowed_weekdays: [5, 6], start_window_from: '09:00', start_window_to: '12:00' }),
  svc('Botox Capilar', 'Tratamento de reposição de massa que reduz o volume e devolve maciez e brilho.', 'Tratamento', 'por_comprimento', 120, [250, null, null, null], { sort_order: 40 }, [120, 150, 180, 210]),
  svc('Progressiva', 'Alisamento progressivo com acabamento natural e movimento.', 'Tratamento', 'por_comprimento', 150, [250, null, null, null], { sort_order: 50 }, [150, 180, 210, 240]),
  svc('Penteado', 'Penteados para festas, formaturas e eventos.', 'Penteado', 'por_comprimento', 60, [250, 250, 250, 'x'], { featured: true, sort_order: 60 }),
]

export const DEFAULT_SETTINGS: SiteSettings = {
  contact: {
    whatsapp: 'https://wa.me/message/Q3WKUDLIJU73M1',
    phone: '(11) 2459-6382',
    instagram: 'studiolaisvettore',
    address: 'Rua Jacareí, 128 — Vila Rosália',
    city: 'Guarulhos — SP',
    cep: '07064-140',
    maps_url: 'https://maps.google.com/?q=Rua+Jacare%C3%AD,+128,+Vila+Ros%C3%A1lia,+Guarulhos+-+SP',
  },
  home: {
    hero_kicker: 'Studio de beleza em Guarulhos',
    hero_title: 'Loiros com assinatura.',
    hero_text: 'Cor, corte e cuidado feitos sob medida por Laís Vettore e equipe. Escolha seu serviço, veja os horários livres e agende em poucos toques.',
    about_title: 'Sobre a Laís',
    about_text: 'Especialista em loiros, mega hair e dia da noiva, a Laís transformou o studio na Vila Rosália em um espaço acolhedor, onde cada cliente sai com um cabelo que conversa com a sua história. Cada atendimento começa com uma conversa — e termina com aquela vontade de se olhar no espelho de novo.',
    bride_text: 'Do teste ao grande dia: penteado, maquiagem, sala privativa e uma equipe inteira dedicada a você e às suas madrinhas.',
  },
  booking: { min_advance_hours: 12, cancel_hours: 24, slot_step_min: 30, horizon_days: 60, max_pending_per_client: 3 },
}

const g = (file: string, caption: string, category: string, i: number): GalleryItem =>
  ({ id: id(), image_url: `img/galeria/${file}.webp`, caption, category, sort_order: i, active: true })

export const DEFAULT_GALLERY: GalleryItem[] = [
  g('loiro-quente', 'Loiro quente e delicado', 'Loiros', 10),
  g('morena-iluminada', 'Morena iluminada', 'Morenas', 20),
  g('loiro-iluminado', 'Loiro iluminado', 'Loiros', 30),
  g('noiva-coque', 'Coque para noiva', 'Noivas', 40),
  g('cacheado', 'Cachos com luzes', 'Cachos', 50),
  g('morena-ondas', 'Morena iluminada com ondas', 'Morenas', 60),
  g('loiro-sorriso', 'Loiro natural', 'Loiros', 70),
  g('morena-mechas', 'Fundo e naturalidade', 'Morenas', 80),
  g('atendimento-lais', 'Laís finalizando', 'Studio', 90),
  g('morena-iluminada-2', 'Morena iluminada — detalhe', 'Morenas', 100),
  g('noiva-coque-2', 'Detalhes do penteado', 'Noivas', 110),
  g('cacheado-2', 'Cachos', 'Cachos', 120),
  g('lais-finalizando', 'Loiro com ondas', 'Loiros', 130),
]

export const TESTIMONIALS = [
  { name: 'Bárbara', text: 'Minha maquiagem e cabelo ficaram perfeitos, o espaço é lindo e isso contribuiu muito para as minhas fotos. Me senti uma princesa.' },
  { name: 'Maendra', text: 'Laís e sua equipe maravilhosos, atenciosos, ambiente agradável. Maquiagem e cabelo impecáveis — eu e todas as minhas madrinhas amamos.' },
  { name: 'Pâmela', text: 'Eu super recomendo a Laís, não somente para o dia de noiva, mas para cuidar de você sempre.' },
  { name: 'Raissa', text: 'Sempre frequentei o studio e simplesmente amo o atendimento, o espaço e principalmente o serviço de todas.' },
]

export type HairLength = 'curto' | 'medio' | 'longo' | 'extra_longo'
export type PriceMode = 'unico' | 'por_comprimento'
export type AppointmentStatus =
  | 'pendente' | 'confirmado' | 'recusado' | 'cancelado' | 'concluido' | 'faltou'

export interface ServicePrice {
  id: string
  service_id: string
  hair_length: HairLength | null
  price: number | null
  duration_min: number | null
  unavailable: boolean
  promo_price: number | null
  promo_from: string | null
  promo_until: string | null
}

export interface Service {
  id: string
  name: string
  description: string | null
  category: string
  price_mode: PriceMode
  duration_min: number
  allowed_weekdays: number[]
  start_window_from: string | null
  start_window_to: string | null
  bookable_online: boolean
  active: boolean
  featured: boolean
  sort_order: number
  service_prices: ServicePrice[]
}

export interface GalleryItem {
  id: string
  image_url: string
  storage_path?: string | null
  caption: string | null
  category: string
  sort_order: number
  active: boolean
}

export interface ContactSettings {
  whatsapp: string
  phone: string
  instagram: string
  address: string
  city: string
  cep: string
  maps_url: string
}

export interface HomeSettings {
  hero_kicker: string
  hero_title: string
  hero_text: string
  about_title: string
  about_text: string
  bride_text: string
}

export interface BookingSettings {
  min_advance_hours: number
  cancel_hours: number
  max_simultaneous: number
  slot_step_min: number
  horizon_days: number
  max_pending_per_client: number
}

export interface SiteSettings {
  contact: ContactSettings
  home: HomeSettings
  booking: BookingSettings
}

export interface BusinessHour {
  weekday: number
  is_open: boolean
  first_start: string
  last_start: string
}

export interface Client {
  id: string
  user_id: string | null
  full_name: string
  phone: string | null
  email: string | null
  birth_date: string | null
  photo_path: string | null
  lgpd_consent_at: string | null
  created_at: string
}

export interface ClientRecord {
  client_id: string
  hair_type: string | null
  hair_length: HairLength | null
  allergies: string | null
  chemical_history: string | null
  notes: string | null
}

export interface Appointment {
  id: string
  client_id: string
  service_id: string | null
  service_name: string
  hair_length: HairLength | null
  starts_at: string
  ends_at: string
  status: AppointmentStatus
  price: number | null
  price_note: string | null
  client_note: string | null
  admin_note: string | null
  clients?: Pick<Client, 'id' | 'full_name' | 'phone'> | null
}

export interface HistoryEntry {
  id: string
  client_id: string
  appointment_id: string | null
  performed_on: string
  service_name: string
  hair_length: HairLength | null
  price: number | null
  formula: string | null
  products: string | null
  internal_notes: string | null
  client_notes: string | null
  photo_paths: string[]
}

export interface ScheduleException {
  id: string
  date: string
  kind: 'fechado' | 'horario_especial' | 'bloqueio'
  first_start: string | null
  last_start: string | null
  block_from: string | null
  block_to: string | null
  note: string | null
}

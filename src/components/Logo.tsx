export function Logo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  const c = light ? 'text-marfim' : 'text-espresso'
  return (
    <span className={`inline-flex flex-col leading-none ${c}`}>
      <span className="font-display text-[1.65rem] italic tracking-tight sm:text-[1.8rem]">Lais Vettore</span>
      {!compact && <span className={`mt-1 text-[0.55rem] font-semibold uppercase tracking-[0.42em] ${light ? 'text-areia/80' : 'text-bronze'}`}>Studio · Guarulhos</span>}
    </span>
  )
}

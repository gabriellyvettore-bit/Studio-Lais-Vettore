import type { ReactNode } from 'react'
export function PageHeader({ kicker, title, children }: { kicker: string; title: ReactNode; children?: ReactNode }) {
  return (
    <section className="mx-auto max-w-[1320px] px-5 pb-10 pt-36 sm:px-8 sm:pt-44">
      <p className="kicker">{kicker}</p>
      <h1 className="mt-5 max-w-4xl text-[clamp(2.8rem,7vw,6rem)] leading-[0.95]">{title}</h1>
      {children && <div className="mt-6 max-w-xl text-[1.02rem] leading-relaxed text-espresso/70">{children}</div>}
    </section>
  )
}

// Ícones de traço fino, desenhados à mão para manter a linguagem do site.
import type { SVGProps } from 'react'
const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...p,
})
export const Arrow = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M4 12h15M13 6l6 6-6 6" /></svg>
export const ArrowLeft = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M20 12H5M11 6l-6 6 6 6" /></svg>
export const Close = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>
export const Menu = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M4 8h16M4 16h16" /></svg>
export const Pin = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.4" /></svg>
export const Clock = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
export const Phone = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M5 4h3.5l1.5 4-2 1.5a11 11 0 0 0 6.5 6.5l1.5-2 4 1.5V19a1.5 1.5 0 0 1-1.6 1.5C10.6 20 4 13.4 3.5 5.6A1.5 1.5 0 0 1 5 4z" /></svg>
export const Instagram = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><rect x="3.5" y="3.5" width="17" height="17" rx="4.5" /><circle cx="12" cy="12" r="3.8" /><circle cx="17.2" cy="6.8" r=".6" fill="currentColor" /></svg>
export const Whats = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M4.5 19.5l1.2-3.6A8 8 0 1 1 8.4 18.6z" /><path d="M9 9.2c.2 2.6 2.9 5.4 5.8 5.8l1-1.3-1.7-.9-.8.8c-1-.4-2-1.4-2.4-2.4l.8-.8-.9-1.7z" /></svg>
export const Check = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M5 12.5l4.2 4L19 7" /></svg>
export const Plus = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>
export const User = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></svg>
export const Lock = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><rect x="5" y="10.5" width="14" height="10" rx="1.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></svg>
export const Calendar = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><rect x="3.5" y="5" width="17" height="15.5" rx="1.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></svg>
export const Scissors = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><circle cx="6" cy="7" r="2.5" /><circle cx="6" cy="17" r="2.5" /><path d="M8.2 8.3L20 18M8.2 15.7L20 6" /></svg>
export const Image = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><rect x="3.5" y="4.5" width="17" height="15" rx="1.5" /><circle cx="9" cy="10" r="1.8" /><path d="M20.5 16l-5-5-8.5 8.5" /></svg>
export const Users = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><circle cx="9" cy="8.5" r="3.3" /><path d="M2.8 19.5a6.2 6.2 0 0 1 12.4 0" /><path d="M15.5 5.6a3.3 3.3 0 0 1 0 6M17.5 13.7a6.2 6.2 0 0 1 3.7 5.8" /></svg>
export const Settings = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2L5.5 5.5" /></svg>
export const Text = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M5 6h14M5 12h14M5 18h9" /></svg>
export const Home = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M4 11l8-6.5 8 6.5V20h-5.5v-5h-5v5H4z" /></svg>
export const Trash = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" /></svg>
export const Edit = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></svg>
export const Up = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M6 15l6-6 6 6" /></svg>
export const Down = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M6 9l6 6 6-6" /></svg>
export const Logout = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M14 4.5H5.5v15H14M10 12h10.5M17 8.5l3.5 3.5-3.5 3.5" /></svg>
export const Google = (p: SVGProps<SVGSVGElement>) => (
  <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden {...p}>
    <path fill="#4285F4" d="M22.5 12.2c0-.8-.1-1.5-.2-2.2H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8.1z" />
    <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2.1v2.8A11 11 0 0 0 12 23z" />
    <path fill="#FBBC05" d="M5.7 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8z" />
    <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1A11 11 0 0 0 2.1 7.1l3.6 2.8C6.6 7.4 9.1 5.4 12 5.4z" />
  </svg>
)

import { assetUrl } from '../lib/supabase'
import type { ImgHTMLAttributes } from 'react'

export function Img({ src, alt, className = '', ...rest }: ImgHTMLAttributes<HTMLImageElement> & { src: string }) {
  return <img src={assetUrl(src)} alt={alt} loading="lazy" decoding="async" className={`block h-full w-full object-cover ${className}`} {...rest} />
}

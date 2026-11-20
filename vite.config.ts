import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// O site é publicado em https://<usuario>.github.io/Studio-Lais-Vettore/
export default defineConfig({
  base: process.env.VITE_BASE ?? '/Studio-Lais-Vettore/',
  plugins: [react(), tailwindcss()],
  build: { sourcemap: false, chunkSizeWarningLimit: 900 },
})

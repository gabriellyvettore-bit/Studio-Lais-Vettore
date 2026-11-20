import { Link } from 'react-router-dom'
export default function NotFound() {
  return (
    <section className="mx-auto flex min-h-[70vh] max-w-[1320px] flex-col items-start justify-center px-5 pt-24 sm:px-8">
      <p className="kicker">Página não encontrada</p>
      <h1 className="mt-5 text-7xl">Ops, esse caminho <em className="text-cacau">não existe.</em></h1>
      <Link to="/" className="btn-dark mt-10">Voltar ao início</Link>
    </section>
  )
}

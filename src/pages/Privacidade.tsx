import { PageHeader } from '../components/PageHeader'
import { useSiteData } from '../context/SiteData'

export default function Privacidade() {
  const { settings } = useSiteData()
  const S = ({ t, children }: { t: string; children: React.ReactNode }) => (
    <section className="border-t border-espresso/15 py-8"><h2 className="text-3xl">{t}</h2><div className="mt-4 space-y-3 leading-relaxed text-espresso/75">{children}</div></section>
  )
  return (
    <>
      <PageHeader kicker="LGPD" title="Política de Privacidade">Como o Studio Lais Vettore cuida dos seus dados, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).</PageHeader>
      <div className="mx-auto max-w-3xl px-5 pb-28 sm:px-8">
        <S t="Quais dados coletamos">
          <p>Nome, celular, data de nascimento, e-mail (somente se você informar ao studio), seus agendamentos e o histórico dos procedimentos realizados no studio — incluindo a ficha técnica (tipo de cabelo, alergias, produtos e fórmulas utilizadas) e, quando você autorizar, fotos de antes e depois.</p>
        </S>
        <S t="Para que usamos">
          <p>Exclusivamente para agendar e realizar seus atendimentos, garantir sua segurança (por exemplo, evitar produtos aos quais você tem alergia) e manter o histórico do seu cabelo. Não vendemos, não compartilhamos e não usamos seus dados para publicidade de terceiros.</p>
        </S>
        <S t="Quem tem acesso">
          <p>Somente você (aos seus próprios dados, em “Meus horários”) e a administração do studio. O acesso administrativo é restrito à conta do studio. As regras de acesso são aplicadas diretamente no banco de dados, e cada alteração em dados sensíveis é registrada.</p>
        </S>
        <S t="Onde ficam armazenados">
          <p>Em um banco de dados com criptografia em trânsito (HTTPS) e em repouso, hospedado pelo Supabase. Não há cadastro com senha: depois do primeiro agendamento, o seu celular fica lembrado neste aparelho por um código aleatório (guardamos apenas uma versão embaralhada e irreversível dele). Em outro aparelho, você acessa com o celular e a data de nascimento. Para proteger você, registramos por até 2 dias as tentativas de acesso (sem guardar o número em si) e limitamos tentativas erradas.</p>
        </S>
        <S t="Seus direitos">
          <p>Em “Meus horários”, você pode a qualquer momento baixar uma cópia de todos os seus dados ou excluir seus dados definitivamente. Também pode pedir correções ou tirar dúvidas pelo telefone {settings.contact.phone} ou pelo Instagram @{settings.contact.instagram}.</p>
        </S>
        <S t="Cookies">
          <p>Usamos apenas o armazenamento local do navegador para lembrar o seu celular neste aparelho (você pode sair a qualquer momento em “Meus horários”). Não usamos cookies de rastreamento ou publicidade.</p>
        </S>
        <p className="border-t border-espresso/15 pt-8 text-sm text-espresso/50">Controlador: Studio Lais Vettore — {settings.contact.address}, {settings.contact.city}. Última atualização: novembro de 2026.</p>
      </div>
    </>
  )
}

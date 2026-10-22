import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useSettingsStore } from '../store/settings';

// Política de privacidade (LGPD). Texto direto, sem juridiquês; revisar com um advogado
// antes de grandes mudanças no produto (novos dados coletados, novos parceiros).
const UPDATED = '24/10/2026';
const CONTACT = 'pehenriqueoliveirarosa@gmail.com';

interface Section {
  title: string;
  body: string[];
}

const PT: { title: string; intro: string; updated: string; back: string; sections: Section[] } = {
  title: 'Política de Privacidade',
  intro:
    'Esta política explica quais dados o NutriChef coleta, para que usa, com quem compartilha e como você controla seus dados, de acordo com a Lei Geral de Proteção de Dados (Lei 13.709/2018).',
  updated: `Atualizada em ${UPDATED}`,
  back: 'Voltar',
  sections: [
    {
      title: '1. Quem é o responsável',
      body: [
        `O NutriChef é desenvolvido e mantido por Pedro Henrique de Oliveira Rosa, controlador dos dados. Dúvidas e pedidos sobre seus dados: ${CONTACT}.`,
      ],
    },
    {
      title: '2. Dados que coletamos',
      body: [
        'Conta: nome, e-mail, tipo de conta (cliente ou nutricionista) e foto de perfil, se você enviar.',
        'Saúde e alimentação (dados sensíveis): perfil de saúde (idade, sexo, altura, peso, objetivo, nível de atividade, alergias e preferências), metas diárias, diário alimentar, histórico de peso, planos alimentares, pedidos de troca e lista de compras.',
        'Nutricionistas: dados profissionais que você publicar (biografia, especialidades, experiência, valor da consulta, endereço), receitas e alimentos cadastrados.',
        'Assinatura: situação do plano Premium. Os dados do cartão ficam só com a Stripe; o NutriChef não os recebe.',
        'Mentoria IA: as mensagens que você envia ao assistente.',
      ],
    },
    {
      title: '3. Para que usamos',
      body: [
        'Fazer o app funcionar: login, diário, metas, planos, receitas, avisos e lista de compras.',
        'Permitir o acompanhamento nutricional quando você aceita o convite de um nutricionista.',
        'Responder suas perguntas na Mentoria IA e cobrar a assinatura Premium.',
        'Não vendemos seus dados e não usamos seus dados de saúde para publicidade.',
      ],
    },
    {
      title: '4. Base legal',
      body: [
        'Dados de saúde são tratados com o seu consentimento específico (art. 11, I da LGPD), dado no cadastro e, de novo, ao aceitar o convite de um nutricionista. Os demais dados são tratados para executar o serviço que você contratou (art. 7, V).',
      ],
    },
    {
      title: '5. Com quem compartilhamos',
      body: [
        'Seu nutricionista: só depois que você aceita o convite e só enquanto o acompanhamento estiver ativo. Ele vê diário, metas, perfil de saúde, peso, planos e pedidos de troca. Você pode encerrar a qualquer momento, e o acesso acaba na hora.',
        'Fornecedores que operam o serviço: Supabase (banco de dados e login), Cloudflare (hospedagem do site), Stripe (pagamentos), Google (envio dos e-mails da conta e o modelo de IA da Mentoria IA). Eles tratam os dados só para prestar esse serviço. Alguns ficam fora do Brasil; a transferência segue o art. 33 da LGPD.',
      ],
    },
    {
      title: '6. Quanto tempo guardamos',
      body: [
        'Enquanto sua conta existir. Avisos lidos são apagados depois de 60 dias. Ao excluir a conta, os dados são apagados na hora, exceto o que a lei obriga a guardar (por exemplo, registros de pagamento na Stripe).',
      ],
    },
    {
      title: '7. Seus direitos',
      body: [
        'Você pode, a qualquer momento: ver e corrigir seus dados no próprio app; baixar uma cópia de todos os seus dados (Perfil > Conta > Baixar meus dados); revogar o acesso do nutricionista (encerrando o acompanhamento); e excluir sua conta com todos os dados (Perfil > Conta > Excluir conta).',
        `Para qualquer outro pedido previsto no art. 18 da LGPD, escreva para ${CONTACT}. Você também pode reclamar à ANPD (Autoridade Nacional de Proteção de Dados).`,
      ],
    },
    {
      title: '8. Segurança',
      body: [
        'Conexões criptografadas (HTTPS), senhas guardadas pelo provedor de login com criptografia, e regras no banco de dados que impedem que um usuário veja os dados de outro, inclusive entre nutricionistas.',
      ],
    },
    {
      title: '9. Mudanças nesta política',
      body: ['Se esta política mudar de forma importante, avisaremos no app antes de a mudança valer.'],
    },
  ],
};

const EN: typeof PT = {
  title: 'Privacy Policy',
  intro:
    'This policy explains what data NutriChef collects, why, who it is shared with and how you control it, under the Brazilian General Data Protection Law (LGPD, Law 13,709/2018).',
  updated: `Updated on ${UPDATED}`,
  back: 'Back',
  sections: [
    { title: '1. Who is responsible', body: [`NutriChef is developed and run by Pedro Henrique de Oliveira Rosa, the data controller. Questions and requests: ${CONTACT}.`] },
    {
      title: '2. Data we collect',
      body: [
        'Account: name, e-mail, account type (client or nutritionist) and profile photo, if you upload one.',
        'Health and food (sensitive data): health profile (age, sex, height, weight, goal, activity level, allergies and preferences), daily goals, food diary, weight history, meal plans, swap requests and shopping list.',
        'Nutritionists: professional details you publish, recipes and foods you register.',
        'Subscription: Premium plan status. Card data stays with Stripe; NutriChef never receives it.',
        'AI Mentoring: the messages you send to the assistant.',
      ],
    },
    {
      title: '3. How we use it',
      body: [
        'To run the app: login, diary, goals, plans, recipes, notifications and shopping list.',
        'To allow nutritional follow-up when you accept a nutritionist invite.',
        'To answer your AI Mentoring questions and to bill the Premium subscription.',
        'We do not sell your data and do not use your health data for advertising.',
      ],
    },
    { title: '4. Legal basis', body: ['Health data is processed with your specific consent (LGPD art. 11, I), given at sign-up and again when you accept a nutritionist invite. Other data is processed to provide the service (art. 7, V).'] },
    {
      title: '5. Who we share it with',
      body: [
        'Your nutritionist: only after you accept the invite and only while the follow-up is active. You can end it anytime and access stops immediately.',
        'Providers that run the service: Supabase (database and login), Cloudflare (hosting), Stripe (payments), Google (account e-mails and the AI Mentoring model). Some are outside Brazil; transfers follow LGPD art. 33.',
      ],
    },
    { title: '6. Retention', body: ['While your account exists. Read notifications are deleted after 60 days. When you delete your account, your data is deleted immediately, except what the law requires us to keep (e.g. payment records at Stripe).'] },
    {
      title: '7. Your rights',
      body: [
        'Anytime you can: see and fix your data in the app; download a copy of all your data (Profile > Account > Download my data); revoke your nutritionist access (end the follow-up); and delete your account with all data (Profile > Account > Delete account).',
        `For any other request under LGPD art. 18, write to ${CONTACT}. You can also complain to the ANPD (Brazilian Data Protection Authority).`,
      ],
    },
    { title: '8. Security', body: ['Encrypted connections (HTTPS), passwords stored encrypted by the login provider, and database rules that prevent any user from seeing another user\'s data.'] },
    { title: '9. Changes', body: ['If this policy changes in an important way, we will let you know in the app before it takes effect.'] },
  ],
};

export function PrivacyPage() {
  const language = useSettingsStore((s) => s.language);
  const c = language === 'pt' ? PT : EN;
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400">
        <ArrowLeft className="h-4 w-4" />
        {c.back}
      </Link>
      <article className="space-y-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900">
        <header className="space-y-2">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            {c.title}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">{c.updated}</p>
          <p className="text-sm text-slate-700 dark:text-slate-300">{c.intro}</p>
        </header>
        {c.sections.map((section) => (
          <section key={section.title} className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">{section.title}</h2>
            {section.body.map((p) => (
              <p key={p} className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {p}
              </p>
            ))}
          </section>
        ))}
      </article>
    </main>
  );
}

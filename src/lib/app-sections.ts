// Como o app se organiza para cada tipo de conta: seções da barra de navegação
// (celular e computador) e as abas do perfil (/perfil?tab=...) dentro de cada uma.

export type TabKey =
  | 'overview'
  | 'plan'
  | 'nutrition'
  | 'shopping'
  | 'messages'
  | 'health'
  | 'patients'
  | 'recipes'
  | 'foods'
  | 'professional'
  | 'favorites'
  | 'account';

/**
 * Para qual público a navegação é montada. A conta de administrador (app_admins) é do tipo
 * paciente no cadastro, mas não acompanha nada como paciente: vê só a Conta e o painel /admin.
 */
export type Role = 'client' | 'nutritionist' | 'admin';

export const roleOf = (userType: string | undefined, isAdmin: boolean): Role =>
  userType === 'Nutritionist' ? 'nutritionist' : isAdmin ? 'admin' : 'client';

export type SectionKey = 'home' | 'plan' | 'messages' | 'patients' | 'profile';

/** Um item da faixa de abas. Com mais de uma aba, elas viram um seletor dentro do item. */
export interface SectionItem {
  key: string;
  tabs: TabKey[];
}

export interface Section {
  key: SectionKey;
  items: SectionItem[];
}

const one = (tab: TabKey): SectionItem => ({ key: tab, tabs: [tab] });

// 'home' é o painel do dia ("Meu dia" do paciente, "Painel" do nutricionista); o Início do app são as receitas.
const CLIENT_SECTIONS: Section[] = [
  { key: 'home', items: [one('overview'), one('nutrition')] },
  { key: 'plan', items: [one('plan'), one('shopping')] },
  { key: 'messages', items: [one('messages')] },
  { key: 'profile', items: [one('health'), one('favorites'), one('account')] },
];

const NUTRITIONIST_SECTIONS: Section[] = [
  { key: 'home', items: [one('overview')] },
  { key: 'patients', items: [one('patients')] },
  { key: 'messages', items: [one('messages')] },
  {
    key: 'profile',
    items: [one('professional'), { key: 'content', tabs: ['recipes', 'foods', 'favorites'] }, one('account')],
  },
];

const ADMIN_SECTIONS: Section[] = [{ key: 'profile', items: [one('account')] }];

const sectionsFor = (role: Role) =>
  role === 'nutritionist' ? NUTRITIONIST_SECTIONS : role === 'admin' ? ADMIN_SECTIONS : CLIENT_SECTIONS;

export const tabsFor = (role: Role): TabKey[] => sectionsFor(role).flatMap((s) => s.items.flatMap((i) => i.tabs));

/** Seção de uma aba; aba desconhecida ou ausente cai na primeira seção (o painel do dia). */
export function sectionOfTab(role: Role, tab: string | null): Section {
  const sections = sectionsFor(role);
  return sections.find((s) => s.items.some((i) => i.tabs.includes(tab as TabKey))) ?? sections[0];
}

/** Endereço de entrada de cada seção. */
export function sectionHref(role: Role, key: SectionKey): string {
  const section = sectionsFor(role).find((s) => s.key === key);
  const tab = section?.items[0].tabs[0];
  return !tab || tab === 'overview' ? '/perfil' : `/perfil?tab=${tab}`;
}

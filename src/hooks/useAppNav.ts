import type { ComponentType } from 'react';
import { useLocation } from 'react-router-dom';
import { CalendarRange, Home, ShieldCheck, LayoutDashboard, MessageCircle, NotebookPen, User, Users } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { useUnreadMessagesStore } from '../store/unread-messages';
import { useTranslation } from './useTranslation';
import { roleOf, sectionHref, sectionOfTab, type Role, type SectionKey } from '../lib/app-sections';
import { usePremiumStore } from '../store/premium';

export interface AppNavItem {
  key: string;
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
  badge?: number;
}

/**
 * Itens da navegação principal (barra de baixo no celular, cabeçalho no computador).
 * O Início é sempre a home de receitas.
 * Paciente: Início · Meu dia (resumo + diário) · Plano · Mensagens · Perfil.
 * Nutricionista: Início · Painel · Pacientes · Mensagens · Perfil.
 */
/** Público da navegação da pessoa logada (paciente, nutricionista ou administrador). */
export function useAppRole(): Role {
  const userType = useAuthStore((s) => s.user?.type);
  const isAdmin = usePremiumStore((s) => s.isAdmin);
  return roleOf(userType, isAdmin);
}

export function useAppNav(): AppNavItem[] {
  const user = useAuthStore((s) => s.user);
  const unread = useUnreadMessagesStore((s) => s.count);
  const { pathname, search } = useLocation();
  const t = useTranslation();
  const role = useAppRole();

  if (!user) return [];
  const onProfile = pathname === '/perfil';
  const current = onProfile ? sectionOfTab(role, new URLSearchParams(search).get('tab')).key : null;
  const section = (key: SectionKey, label: string, icon: AppNavItem['icon'], badge?: number): AppNavItem => ({
    key,
    to: sectionHref(role, key),
    label,
    icon,
    active: current === key,
    badge,
  });

  const recipes: AppNavItem = {
    key: 'recipes',
    to: '/',
    label: t.nav.home,
    icon: Home,
    active: pathname === '/' || pathname.startsWith('/receita/'),
  };

  if (role === 'admin') {
    return [
      recipes,
      { key: 'admin', to: '/admin', label: 'Admin', icon: ShieldCheck, active: pathname === '/admin' },
      section('profile', t.nav.profile, User),
    ];
  }

  return role === 'nutritionist'
    ? [
        recipes,
        section('home', t.nav.dashboard, LayoutDashboard),
        section('patients', t.nav.patients, Users),
        section('messages', t.nav.messages, MessageCircle, unread),
        section('profile', t.nav.profile, User),
      ]
    : [
        recipes,
        section('home', t.nav.today, NotebookPen),
        section('plan', t.nav.plan, CalendarRange),
        section('messages', t.nav.messages, MessageCircle, unread),
        section('profile', t.nav.profile, User),
      ];
}

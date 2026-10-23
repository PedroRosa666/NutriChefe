import type { ComponentType } from 'react';
import { useLocation } from 'react-router-dom';
import { BookOpen, CalendarRange, Home, LayoutDashboard, MessageCircle, NotebookPen, User, Users } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { useUnreadMessagesStore } from '../store/unread-messages';
import { useTranslation } from './useTranslation';
import { sectionHref, sectionOfTab, type SectionKey } from '../lib/app-sections';

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
 * Paciente: Início · Plano · Diário · Mensagens · Perfil.
 * Nutricionista: Painel · Pacientes · Mensagens · Receitas · Perfil.
 */
export function useAppNav(): AppNavItem[] {
  const user = useAuthStore((s) => s.user);
  const unread = useUnreadMessagesStore((s) => s.count);
  const { pathname, search } = useLocation();
  const t = useTranslation();

  if (!user) return [];
  const isNutritionist = user.type === 'Nutritionist';
  const onProfile = pathname === '/perfil';
  const current = onProfile ? sectionOfTab(isNutritionist, new URLSearchParams(search).get('tab')).key : null;
  const section = (key: SectionKey, label: string, icon: AppNavItem['icon'], badge?: number): AppNavItem => ({
    key,
    to: sectionHref(isNutritionist, key),
    label,
    icon,
    active: current === key,
    badge,
  });

  return isNutritionist
    ? [
        section('home', t.nav.dashboard, LayoutDashboard),
        section('patients', t.nav.patients, Users),
        section('messages', t.nav.messages, MessageCircle, unread),
        {
          key: 'recipes',
          to: '/',
          label: t.nav.recipes,
          icon: BookOpen,
          active: pathname === '/' || pathname.startsWith('/receita/'),
        },
        section('profile', t.nav.profile, User),
      ]
    : [
        section('home', t.nav.home, Home),
        section('plan', t.nav.plan, CalendarRange),
        section('diary', t.nav.diary, NotebookPen),
        section('messages', t.nav.messages, MessageCircle, unread),
        section('profile', t.nav.profile, User),
      ];
}

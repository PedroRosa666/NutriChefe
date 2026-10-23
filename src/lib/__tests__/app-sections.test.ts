import { describe, expect, it } from 'vitest';
import { roleOf, sectionHref, sectionOfTab, tabsFor } from '../app-sections';

describe('app sections', () => {
  it('maps each patient tab to its navigation section', () => {
    expect(sectionOfTab('client', null).key).toBe('home');
    expect(sectionOfTab('client', 'plan').key).toBe('plan');
    expect(sectionOfTab('client', 'shopping').key).toBe('plan');
    expect(sectionOfTab('client', 'nutrition').key).toBe('home');
    expect(sectionOfTab('client', 'messages').key).toBe('messages');
    expect(sectionOfTab('client', 'health').key).toBe('profile');
    expect(sectionOfTab('client', 'account').key).toBe('profile');
  });

  it('groups the nutritionist content tabs under Profile', () => {
    for (const tab of ['recipes', 'foods', 'favorites', 'professional', 'account']) {
      expect(sectionOfTab('nutritionist', tab).key).toBe('profile');
    }
    expect(sectionOfTab('nutritionist', 'patients').key).toBe('patients');
    expect(sectionOfTab('nutritionist', 'messages').key).toBe('messages');
  });

  it('falls back to Home for unknown or other-role tabs', () => {
    expect(sectionOfTab('client', 'patients').key).toBe('home');
    expect(sectionOfTab('nutritionist', 'plan').key).toBe('home');
    expect(sectionOfTab('nutritionist', 'nope').key).toBe('home');
  });

  it('links each section to its first tab', () => {
    expect(sectionHref('client', 'home')).toBe('/perfil');
    expect(sectionHref('client', 'plan')).toBe('/perfil?tab=plan');
    expect(sectionHref('client', 'profile')).toBe('/perfil?tab=health');
    expect(sectionHref('nutritionist', 'profile')).toBe('/perfil?tab=professional');
  });

  it('gives the admin account only the Account tab', () => {
    expect(roleOf('Client', true)).toBe('admin');
    expect(roleOf('Nutritionist', true)).toBe('nutritionist');
    expect(roleOf('Client', false)).toBe('client');
    expect(tabsFor('admin')).toEqual(['account']);
    expect(sectionOfTab('admin', 'plan').key).toBe('profile');
    expect(sectionHref('admin', 'profile')).toBe('/perfil?tab=account');
  });

  it('keeps every tab reachable exactly once', () => {
    for (const role of ['client', 'nutritionist', 'admin'] as const) {
      const tabs = tabsFor(role);
      expect(new Set(tabs).size).toBe(tabs.length);
    }
    expect(tabsFor('client')).toHaveLength(8);
    expect(tabsFor('nutritionist')).toHaveLength(8);
  });
});

import { describe, expect, it } from 'vitest';
import { sectionHref, sectionOfTab, tabsFor } from '../app-sections';

describe('app sections', () => {
  it('maps each patient tab to its navigation section', () => {
    expect(sectionOfTab(false, null).key).toBe('home');
    expect(sectionOfTab(false, 'plan').key).toBe('plan');
    expect(sectionOfTab(false, 'shopping').key).toBe('plan');
    expect(sectionOfTab(false, 'nutrition').key).toBe('diary');
    expect(sectionOfTab(false, 'messages').key).toBe('messages');
    expect(sectionOfTab(false, 'health').key).toBe('profile');
    expect(sectionOfTab(false, 'account').key).toBe('profile');
  });

  it('groups the nutritionist content tabs under Profile', () => {
    for (const tab of ['recipes', 'foods', 'favorites', 'professional', 'account']) {
      expect(sectionOfTab(true, tab).key).toBe('profile');
    }
    expect(sectionOfTab(true, 'patients').key).toBe('patients');
    expect(sectionOfTab(true, 'messages').key).toBe('messages');
  });

  it('falls back to Home for unknown or other-role tabs', () => {
    expect(sectionOfTab(false, 'patients').key).toBe('home');
    expect(sectionOfTab(true, 'plan').key).toBe('home');
    expect(sectionOfTab(true, 'nope').key).toBe('home');
  });

  it('links each section to its first tab', () => {
    expect(sectionHref(false, 'home')).toBe('/perfil');
    expect(sectionHref(false, 'diary')).toBe('/perfil?tab=nutrition');
    expect(sectionHref(false, 'profile')).toBe('/perfil?tab=health');
    expect(sectionHref(true, 'profile')).toBe('/perfil?tab=professional');
  });

  it('keeps every tab reachable exactly once', () => {
    for (const role of [false, true]) {
      const tabs = tabsFor(role);
      expect(new Set(tabs).size).toBe(tabs.length);
    }
    expect(tabsFor(false)).toHaveLength(8);
    expect(tabsFor(true)).toHaveLength(8);
  });
});

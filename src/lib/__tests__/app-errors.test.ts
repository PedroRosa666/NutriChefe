import { describe, expect, it } from 'vitest';
import { errorCode, errorText } from '../app-errors';
import { en } from '../i18n/en';
import { pt } from '../i18n/pt';

const translations = { en, pt };

describe('errorCode', () => {
  it('usa o código levantado pelo banco, exatamente', () => {
    expect(errorCode({ message: 'version_conflict', code: 'P0001' })).toBe('version_conflict');
    expect(errorCode({ message: 'operation_conflict' })).toBe('operation_conflict');
    // Palavra solta dentro de outra frase não conta.
    expect(errorCode({ message: 'could not resolve version_conflict marker' })).toBe('unknown');
  });

  it('traduz códigos do Postgres e falhas de rede', () => {
    expect(errorCode({ message: 'new row violates row-level security policy', code: '42501' })).toBe('not_allowed');
    expect(errorCode({ message: 'violates check constraint', code: '23514' })).toBe('validation_failed');
    expect(errorCode(new TypeError('Failed to fetch'))).toBe('temporarily_unavailable');
    expect(errorCode({ message: 'Bad gateway', status: 502 })).toBe('temporarily_unavailable');
    expect(errorCode(null)).toBe('unknown');
  });

  it('todo código tem texto nos dois idiomas', () => {
    expect(errorText({ message: 'resource_archived' }, translations.pt.appErrors)).toBe(translations.pt.appErrors.resource_archived);
    expect(Object.keys(translations.en.appErrors).sort()).toEqual(Object.keys(translations.pt.appErrors).sort());
  });
});

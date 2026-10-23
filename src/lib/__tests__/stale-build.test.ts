import { describe, expect, it } from 'vitest';
import { isStaleBuildError } from '../stale-build';

describe('isStaleBuildError', () => {
  it('reconhece o erro de arquivo da versão antiga nos navegadores', () => {
    expect(isStaleBuildError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/a.js'))).toBe(true);
    expect(isStaleBuildError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isStaleBuildError(new Error('error loading dynamically imported module'))).toBe(true);
    expect(isStaleBuildError('Unable to preload CSS for /assets/x.css')).toBe(true);
  });

  it('não confunde com outros erros', () => {
    expect(isStaleBuildError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isStaleBuildError(null)).toBe(false);
  });
});

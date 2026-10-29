import { describe, expect, it } from 'vitest';
import { updateCheck } from '../client-contract';

describe('aviso de atualização', () => {
  it('app em dia com o banco: nada a mostrar', () => {
    expect(updateCheck(5, 5, 5)).toBe('current');
    expect(updateCheck(4, null, 5)).toBe('current');
  });

  it('site no ar já atende o banco: recarregar resolve, então avisa', () => {
    expect(updateCheck(5, 5, 4)).toBe('reload');
    expect(updateCheck(5, 6, 4)).toBe('reload');
  });

  it('migração aplicada antes do deploy: sem aviso (recarregar traria o mesmo site)', () => {
    expect(updateCheck(5, 4, 4)).toBe('deploy_behind');
    expect(updateCheck(5, null, 4)).toBe('deploy_behind');
  });
});

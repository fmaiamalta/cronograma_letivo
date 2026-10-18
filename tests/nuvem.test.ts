import { describe, expect, it } from 'vitest';
import { fundir } from '../src/lib/nuvem';
import { estadoInicial, exemplo } from '../src/lib/presets';

describe('fundir dados da conta com os do aparelho', () => {
  const base = { ...estadoInicial(), ...exemplo() };
  it('vale o da conta, incluindo o catálogo', () => {
    const remoto = structuredClone(base);
    remoto.disciplinas = remoto.disciplinas.slice(0, 1);
    remoto.catalogo = remoto.catalogo.slice(0, 3);
    const r = fundir(base, remoto);
    expect(r.disciplinas).toHaveLength(1);
    expect(r.catalogo).toHaveLength(3);
  });
  it('tarefa feita neste aparelho continua feita', () => {
    const local = structuredClone(base);
    local.disciplinas[0].modulos[0].tarefas[1].feita = true;
    const r = fundir(local, base);
    expect(r.disciplinas[0].modulos[0].tarefas[1].feita).toBe(true);
  });
});

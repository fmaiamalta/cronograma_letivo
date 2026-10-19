import { describe, expect, it } from 'vitest';
import { aplicarPacote, codificar, descodificar, linkDados } from '../src/lib/transfer';
import { estadoInicial, exemplo } from '../src/lib/presets';

describe('passagem computador → telemóvel', () => {
  const pc = { ...estadoInicial(), ...exemplo() };

  it('ida e volta pelo código e pelo link', async () => {
    const codigo = await codificar(pc);
    expect(codigo.startsWith('CL1.')).toBe(true);
    const p = await descodificar(linkDados(codigo, 'https://x.pt/app/'));
    expect(p?.disciplinas).toEqual(pc.disciplinas);
    expect(p?.calendario).toEqual(pc.calendario);
  });

  it('o código de um horário de exemplo é curto', async () => {
    expect((await codificar(pc)).length).toBeLessThan(2500);
  });

  it('rejeita lixo', async () => {
    expect(await descodificar('olá')).toBeNull();
    expect(await descodificar('CL1.abc')).toBeNull();
  });

  it('mantém tarefas marcadas no telemóvel e o catálogo local', () => {
    const tel = structuredClone(pc);
    const tarefa = tel.disciplinas[0].modulos[0].tarefas[1];
    tarefa.feita = true;
    tel.catalogo = [];
    const r = aplicarPacote(tel, { calendario: pc.calendario, disciplinas: pc.disciplinas, periodosTurma: pc.periodosTurma });
    expect(r.disciplinas[0].modulos[0].tarefas[1].feita).toBe(true);
    expect(r.catalogo).toEqual([]);
  });

  it('leva as faltas do professor; um código antigo mantém as do aparelho', async () => {
    const pc = { ...estadoInicial(), ausencias: [{ id: 'g', nome: 'Greve', inicio: '2026-11-13', fim: '2026-11-13' }] };
    const p = await descodificar(await codificar(pc));
    expect(p?.ausencias).toEqual(pc.ausencias);
    const tel = { ...estadoInicial(), ausencias: [{ id: 'd', nome: 'Doença', inicio: '2026-11-20', fim: '2026-11-20' }] };
    expect(aplicarPacote(tel, { calendario: pc.calendario, disciplinas: [], periodosTurma: [] }).ausencias).toEqual(tel.ausencias);
  });
});

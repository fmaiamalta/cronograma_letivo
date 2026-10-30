import { describe, expect, it } from 'vitest';
import { addDays, weekday } from '../src/lib/dates';
import { diasDeAula, planear, temposDoModulo } from '../src/lib/engine';
import { calendario2026 } from '../src/lib/presets';
import type { Disciplina, Modulo } from '../src/lib/types';

const mod = (id: string, quantidade: number, unidade: 'h' | 't' = 't'): Modulo => ({ id, nome: id, quantidade, unidade, tarefas: [] });

function disciplina(over: Partial<Disciplina> = {}): Disciplina {
  return {
    id: 'd1', turma: '10.º M', nome: 'SI', ano: 10, componente: 'tecnologica', cor: '#000',
    tempos: [2, 0, 2, 0, 0, 0, 0], diasSemAula: [], modulos: [], ...over,
  };
}

describe('temposDoModulo', () => {
  it('converte horas em tempos de 50 minutos', () => {
    expect(temposDoModulo(mod('a', 25, 'h'), 50)).toBe(30);
    expect(temposDoModulo(mod('a', 50, 'h'), 50)).toBe(60);
    expect(temposDoModulo(mod('a', 100, 'h'), 45)).toBe(133);
  });
  it('mantém tempos quando a unidade já é tempos', () => {
    expect(temposDoModulo(mod('a', 50, 't'), 50)).toBe(50);
  });
});

describe('diasDeAula', () => {
  const cal = calendario2026();
  const dias = diasDeAula(disciplina(), cal, []);

  it('só tem segundas e quartas', () => {
    expect(dias.every((d) => [0, 2].includes(weekday(d.data)))).toBe(true);
  });
  it('salta interrupções e feriados', () => {
    const datas = dias.map((d) => d.data);
    expect(datas).not.toContain('2026-10-05'); // Implantação da República (segunda)
    expect(datas.some((d) => d >= '2026-12-16' && d <= '2026-12-31')).toBe(false);
    expect(datas.some((d) => d >= '2027-03-22' && d <= '2027-04-02')).toBe(false);
    expect(datas).not.toContain('2027-02-08'); // Carnaval (segunda)
    expect(datas).not.toContain('2027-02-10'); // Carnaval (quarta)
  });
  it('respeita início e fim do ano para o 10.º ano', () => {
    expect(dias[0].data).toBe('2026-09-16'); // começa a 15 (terça); 1.ª aula na quarta
    expect(dias[dias.length - 1].data <= '2027-06-11').toBe(true);
  });
  it('salta períodos da turma (FCT) e dias sem aula da disciplina', () => {
    const d = disciplina({ diasSemAula: ['2026-09-21'] });
    const comFct = diasDeAula(d, cal, [{ id: 'p', turma: '10.º M', nome: 'FCT', inicio: '2026-10-01', fim: '2026-10-31' }]);
    const datas = comFct.map((x) => x.data);
    expect(datas).not.toContain('2026-09-21');
    expect(datas.some((x) => x.startsWith('2026-10'))).toBe(false);
    // Período de outra turma não conta.
    const outra = diasDeAula(d, cal, [{ id: 'p', turma: '12.º M', nome: 'FCT', inicio: '2026-10-01', fim: '2026-10-31' }]);
    expect(outra.some((x) => x.data.startsWith('2026-10'))).toBe(true);
  });
});

describe('planear', () => {
  const cal = calendario2026();

  it('encadeia módulos e parte um dia entre dois módulos', () => {
    // 4 tempos por semana; módulo A tem 5 tempos: acaba a meio do 3.º dia.
    const p = planear(disciplina({ modulos: [mod('A', 5), mod('B', 3)] }), cal, [], '2026-09-01');
    const [a, b] = p.modulos;
    expect(a.sessoes.map((s) => [s.data, s.tempos])).toEqual([
      ['2026-09-16', 2], ['2026-09-21', 2], ['2026-09-23', 1],
    ]);
    expect(b.sessoes.map((s) => [s.data, s.tempos])).toEqual([
      ['2026-09-23', 1], ['2026-09-28', 2],
    ]);
    expect(a.fim).toBe('2026-09-23');
    expect(b.inicio).toBe('2026-09-23');
  });

  it('um módulo que atravessa o Natal continua em janeiro', () => {
    const p = planear(disciplina({ inicio: '2026-12-01', modulos: [mod('A', 12)] }), cal, [], '2026-09-01');
    const datas = p.modulos[0].sessoes.map((s) => s.data);
    // 01/12 e 08/12 são feriados (terças): não há aula às terças aqui, mas as segundas e quartas contam.
    expect(datas).toEqual(['2026-12-02', '2026-12-07', '2026-12-09', '2026-12-14', '2027-01-04', '2027-01-06']);
  });

  it('conta os tempos dados até hoje', () => {
    const p = planear(disciplina({ modulos: [mod('A', 10)] }), cal, [], '2026-09-21');
    expect(p.modulos[0].dados).toBe(4);
  });

  it('assinala os tempos que não cabem no ano', () => {
    const p = planear(disciplina({ tempos: [1, 0, 0, 0, 0, 0, 0], modulos: [mod('A', 500)] }), cal, [], '2026-09-01');
    expect(p.modulos[0].emFalta).toBeGreaterThan(0);
    expect(p.modulos[0].emFalta).toBe(500 - p.temposDisponiveis);
  });

  it('ignora módulos com zero tempos sem bloquear os seguintes', () => {
    const p = planear(disciplina({ modulos: [mod('A', 0), mod('B', 2)] }), cal, [], '2026-09-01');
    expect(p.modulos[0].sessoes).toEqual([]);
    expect(p.modulos[1].inicio).toBe('2026-09-16');
  });

  it('não depende da hora de verão (mudança a 25/10/2026)', () => {
    let d = '2026-10-20';
    const vistos: string[] = [];
    for (let i = 0; i < 10; i++) { vistos.push(d); d = addDays(d, 1); }
    expect(vistos).toContain('2026-10-25');
    expect(vistos).toContain('2026-10-26');
    expect(new Set(vistos).size).toBe(10);
  });
});

describe('ensino geral (disciplina anual)', () => {
  const cal = { ...calendario2026(), inicioPorEnsino: { secundario: '2026-09-21' } };
  it('ocupa todas as aulas do ano e começa no início do nível', () => {
    const d = disciplina({ ano: 11, ensino: 'secundario', modulos: [{ ...mod('Matemática A', 0), anual: true }] });
    const p = planear(d, cal, [], '2026-09-01');
    expect(p.modulos[0].totalTempos).toBe(p.temposDisponiveis);
    expect(p.modulos[0].emFalta).toBe(0);
    expect(p.modulos[0].inicio).toBe('2026-09-21');
    expect(p.modulos[0].fim! <= '2027-06-04').toBe(true);
  });
  it('9.º ano acaba a 4/6 e 5.º a 11/6', () => {
    const d9 = planear(disciplina({ ano: 9, ensino: 'basico', modulos: [{ ...mod('Português', 0), anual: true }] }), cal, [], '2026-09-01');
    const d5 = planear(disciplina({ ano: 5, ensino: 'basico', modulos: [{ ...mod('Português', 0), anual: true }] }), cal, [], '2026-09-01');
    expect(d9.fim).toBe('2027-06-04');
    expect(d5.fim).toBe('2027-06-11');
    expect(d5.inicio).toBe('2026-09-15');
  });
});

describe('faltas do professor', () => {
  const cal = calendario2026();
  const greve = { id: 'g', nome: 'Greve', inicio: '2026-09-21', fim: '2026-09-21' };

  it('o módulo passa para a aula seguinte e acaba mais tarde', () => {
    const sem = planear(disciplina({ modulos: [mod('A', 5), mod('B', 3)] }), cal, [], '2026-09-01');
    const com = planear(disciplina({ modulos: [mod('A', 5), mod('B', 3)] }), cal, [], '2026-09-01', [greve]);
    expect(com.modulos[0].sessoes.map((s) => s.data)).toEqual(['2026-09-16', '2026-09-23', '2026-09-28']);
    expect(com.modulos[0].fim! > sem.modulos[0].fim!).toBe(true);
    expect(com.modulos[1].fim).toBe('2026-09-30');
    expect(com.modulos[0].emFalta).toBe(0);
  });

  it('uma semana de baixa vale para todas as disciplinas', () => {
    const baixa = { id: 'b', nome: 'Doença', inicio: '2026-10-05', fim: '2026-10-09' };
    const dias = diasDeAula(disciplina({ tempos: [1, 1, 1, 1, 1, 0, 0] }), cal, [], [baixa]);
    expect(dias.some((d) => d.data >= '2026-10-05' && d.data <= '2026-10-09')).toBe(false);
  });
});

describe('minutos que cada tempo conta', () => {
  const cal = calendario2026();
  it('aulas de 50 min que contam 60: 25 h são 25 tempos', () => {
    const d50 = planear(disciplina({ modulos: [mod('A', 25, 'h')] }), cal, [], '2026-09-01');
    const d60 = planear(disciplina({ minutosPorTempo: 60, modulos: [mod('A', 25, 'h')] }), cal, [], '2026-09-01');
    expect(d50.modulos[0].totalTempos).toBe(30);
    expect(d60.modulos[0].totalTempos).toBe(25);
    expect(d60.modulos[0].fim! < d50.modulos[0].fim!).toBe(true);
  });
});

describe('sem aula numa só disciplina', () => {
  const cal = calendario2026();
  // 2 tempos à segunda e à quarta; 21/09 é segunda.
  it('perder 1 dos 2 tempos adia o módulo só esse tempo', () => {
    const sem = planear(disciplina({ modulos: [mod('A', 6)] }), cal, [], '2026-09-01');
    const um = planear(disciplina({ modulos: [mod('A', 6)] }), cal, [], '2026-09-01', [{ id: 'c', nome: 'Consulta', inicio: '2026-09-21', fim: '2026-09-21', disciplinaId: 'd1', tempos: 1 }]);
    expect(sem.modulos[0].sessoes.map((s) => `${s.data} ${s.tempos}`)).toEqual(['2026-09-16 2', '2026-09-21 2', '2026-09-23 2']);
    expect(um.modulos[0].sessoes.map((s) => `${s.data} ${s.tempos}`)).toEqual(['2026-09-16 2', '2026-09-21 1', '2026-09-23 2', '2026-09-28 1']);
  });
  it('a ausência de outra disciplina não mexe nesta', () => {
    const outra = planear(disciplina({ modulos: [mod('A', 6)] }), cal, [], '2026-09-01', [{ id: 'c', nome: 'Consulta', inicio: '2026-09-21', fim: '2026-09-21', disciplinaId: 'outra' }]);
    expect(outra.modulos[0].fim).toBe('2026-09-23');
  });
});

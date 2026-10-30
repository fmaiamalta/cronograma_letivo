import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { atividadesDe, aulasDe, aulasSemDisciplina, blocosDoEstado, importarHorario, somarMinutos, disciplinaDoBloco, ehAula, lerHorarioICS, nomeTurmas, sigla, temposDoHorario } from '../src/lib/horario';
import { estadoInicial } from '../src/lib/presets';
import type { Disciplina } from '../src/lib/types';

const ics = readFileSync(new URL('./fixtures/horario-inforarios.ics', import.meta.url), 'utf8');

function disc(turma: string, nome: string, ano: Disciplina['ano'] = 10): Disciplina {
  return { id: `${turma}|${nome}`, turma, nome, ano, componente: 'tecnologica', cor: '#000', tempos: [9, 9, 9, 9, 9, 0, 0], diasSemAula: [], modulos: [] };
}

// Como estão no cronograma do professor.
const minhas = [
  disc('12M', 'PPM', 12), disc('10M', 'SI'), disc('10M', 'Tecnologias da Informação e Comunicação'),
  disc('10D', 'Tecnologias da Informação e Comunicação'), disc('12C', 'Aplicações Informáticas B', 12),
  disc('12H2H3', 'Aplicações Informáticas B', 12), disc('9A', '', 9), disc('9B', '', 9),
];

describe('horário do inforarios (.ics)', () => {
  const blocos = lerHorarioICS(ics);

  it('lê os 25 blocos com dia, horas, turmas e sala', () => {
    expect(blocos).toHaveLength(25);
    expect(blocos[0]).toMatchObject({ dia: 0, inicio: '09:15', fim: '10:05', titulo: 'Aplicações Informáticas B', turmas: ['12H2', '12H3'], sala: 'A1SE2' });
    expect(blocos.filter((b) => !ehAula(b)).map((b) => b.titulo)).toEqual(['Equipa TIC', 'Equipa TIC', 'Reuniões']);
    expect(blocos.find((b) => b.titulo === 'Sistemas de Informação')?.turmas).toEqual(['10M']);
  });

  it('siglas e turmas juntas', () => {
    expect(sigla('Tecnologias da Informação e da Comunicação')).toBe('TIC');
    expect(sigla('Aplicações Informáticas B')).toBe('AIB');
    expect(sigla('PPM')).toBe('PPM');
    expect(nomeTurmas(['12H2', '12H3'])).toBe('12H2H3');
  });

  it('liga cada aula à disciplina do cronograma', () => {
    const tic9 = blocos.find((b) => b.turmas[0] === 'D9A')!;
    expect(disciplinaDoBloco(tic9, minhas, blocos)?.turma).toBe('9A');
    expect(aulasSemDisciplina(blocos, minhas)).toEqual([]);
  });

  it('conta os tempos por dia de cada disciplina', () => {
    const t = temposDoHorario(blocos, minhas, 50);
    expect(t.get('10M|SI')).toEqual([2, 0, 0, 0, 0, 0, 0]);
    expect(t.get('10M|Tecnologias da Informação e Comunicação')).toEqual([2, 2, 0, 0, 0, 0, 0]);
    expect(t.get('12M|PPM')).toEqual([0, 2, 1, 0, 1, 0, 0]);
    expect(t.get('12H2H3|Aplicações Informáticas B')).toEqual([1, 0, 0, 0, 2, 0, 0]);
    expect(t.get('12C|Aplicações Informáticas B')).toEqual([0, 1, 0, 2, 0, 0, 0]);
    expect(t.get('9A|')).toEqual([0, 0, 0, 1, 0, 0, 0]);
  });

  it('sem disciplinas, cria-as a partir do horário', () => {
    const vazias = aulasSemDisciplina(blocos, []);
    expect(vazias).toHaveLength(8);
    const e = importarHorario(estadoInicial(), blocos, vazias);
    expect(e.disciplinas.map((d) => `${d.turma} ${d.ensino}`)).toContain('12H2H3 profissional');
    expect(e.disciplinas.find((d) => d.turma === 'D9A')).toMatchObject({ ano: 9, ensino: 'basico', tempos: [0, 0, 0, 1, 0, 0, 0] });
    expect(e.atividades?.map((a) => a.nome)).toEqual(['Equipa TIC', 'Equipa TIC', 'Reuniões']);
  });

  it('importa para aulas com hora e tempos seguidos, e a grelha fica igual', () => {
    const e = importarHorario({ ...estadoInicial(), disciplinas: minhas }, blocos);
    const tic10m = e.disciplinas.find((d) => d.id === '10M|Tecnologias da Informação e Comunicação')!;
    expect(tic10m.aulas?.map((a) => `${a.dia} ${a.inicio} ${a.tempos} ${a.sala}`)).toEqual(['0 10:25 2 F103', '1 15:30 2 F103']);
    const grelha = blocosDoEstado(e).map((b) => `${b.dia} ${b.inicio}-${b.fim} ${b.sala ?? ''}`).sort();
    const original = blocos.map((b) => `${b.dia} ${b.inicio}-${b.fim} ${b.sala ?? ''}`).sort();
    expect(grelha).toEqual(original);
  });

  it('dados antigos (horário importado antes) continuam a dar aulas e atividades', () => {
    const antigo = { ...estadoInicial(), disciplinas: minhas, horario: { blocos } };
    const ppm = minhas.find((d) => d.turma === '12M')!;
    expect(aulasDe(ppm, antigo).map((a) => `${a.dia} ${a.inicio} ${a.tempos}`)).toEqual(['1 13:30 2', '2 10:25 1', '4 12:25 1']);
    expect(atividadesDe(antigo)).toHaveLength(3);
  });

  it('cada tempo é um bloco de 50 min, com 10 min de intervalo escondido', () => {
    const d = { ...disc('10M', 'SI'), aulas: [{ id: 'a', dia: 0, inicio: '14:30', tempos: 2, sala: 'F103' }] };
    const e = { ...estadoInicial(), disciplinas: [d], atividades: [{ id: 't', nome: 'Equipa TIC', dia: 1, inicio: '11:25', fim: somarMinutos('11:25', 50) }] };
    expect(blocosDoEstado(e).map((b) => `${b.dia} ${b.inicio}-${b.fim} ${b.titulo}`)).toEqual(['0 14:30-15:20 SI', '0 15:30-16:20 SI', '1 11:25-12:15 Equipa TIC']);
  });

  it('liga abreviaturas do Untis às disciplinas', () => {
    const hca = disc('11A', 'História da Cultura e das Artes', 11);
    const hist = disc('7A EQ', 'História', 7);
    const b = (titulo: string, turma: string) => ({ id: titulo, dia: 0, inicio: '08:15', fim: '09:05', titulo, turmas: [turma] });
    expect(disciplinaDoBloco(b('H.C.A.', '11A'), [hca, hist], [])?.nome).toBe('História da Cultura e das Artes');
    expect(disciplinaDoBloco(b('Hist.', '7A EQ'), [hca, hist], [])?.nome).toBe('História');
  });
});

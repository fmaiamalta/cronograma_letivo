import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { lerCalendario } from '../src/lib/calendarParse';
import { weekday } from '../src/lib/dates';
import { diasDeAula } from '../src/lib/engine';
import { textoDeItens, type ItemPDF } from '../src/lib/pdfLayout';
import type { CalendarioEscolar, Disciplina } from '../src/lib/types';

// Pedaços de texto (pdf.js) da 1.ª página de um calendário escolar 2026/2027 real,
// em grelha mensal com legenda por baixo.
const itens = JSON.parse(readFileSync(new URL('./fixtures/calendario-escola-p1.json', import.meta.url), 'utf8')) as ItemPDF[];
const texto = textoDeItens(itens);
const s = lerCalendario(texto, 2026, itens);

describe('PDF de calendário em grelha', () => {
  it('junta letras partidas pelo PDF', () => {
    expect(texto).toContain('NATAL de 16 Dezembro a 31 de Dezembro');
    expect(texto).toContain('CARNAVAL de 08 a 10 Fevereiro');
  });

  it('lê as interrupções da legenda', () => {
    expect(s.interrupcoes).toEqual([
      { nome: 'Natal', inicio: '2026-12-16', fim: '2026-12-31' },
      { nome: 'Carnaval', inicio: '2027-02-08', fim: '2027-02-10' },
      { nome: 'Páscoa', inicio: '2027-03-22', fim: '2027-04-02' },
    ]);
  });

  it('lê os dois inícios e o fim por ano', () => {
    expect(s.inicios.map((x) => x.data)).toEqual(['2026-09-15', '2026-09-21']);
    expect(s.inicios[1].nota).toMatch(/Secund/);
    expect(s.fimPorAno).toEqual({ 10: '2027-06-11', 11: '2027-06-04', 12: '2027-06-04' });
  });

  it('lê os feriados da grelha e ignora dias comemorativos', () => {
    expect(s.feriados.map((f) => f.data)).toEqual([
      '2026-10-05', '2026-11-01', '2026-12-01', '2026-12-08', '2026-12-25', '2027-01-01',
      '2027-02-09', '2027-04-25', '2027-05-01', '2027-05-27', '2027-06-10', '2027-06-13',
    ]);
    const nomes = s.feriados.map((f) => f.nome).join(' ');
    expect(nomes).not.toMatch(/Valentim|Mãe|Mulher|Reis|Ramos|Criança/);
  });
});

describe('contagem de dias de aula igual à da escola (secundário, a partir de 21/09)', () => {
  const cal: CalendarioEscolar = {
    anoLetivo: '2026/2027',
    escola: '',
    inicio: '2026-09-21',
    fimPorAno: { 10: '2027-06-11', 11: '2027-06-04', 12: '2027-06-04' },
    interrupcoes: s.interrupcoes.map((i, k) => ({ id: String(k), ...i })),
    feriados: s.feriados.map((f, k) => ({ id: String(k), ...f })),
    minutosPorTempo: 50,
  };
  const contar = (ano: 10 | 11 | 12, de: string, ate: string) => {
    const d: Disciplina = {
      id: 'x', turma: 'T', nome: 'N', ano, componente: 'tecnologica', cor: '#000',
      tempos: [1, 1, 1, 1, 1, 0, 0], diasSemAula: [], modulos: [],
    };
    const n = [0, 0, 0, 0, 0];
    for (const x of diasDeAula(d, cal, [])) if (x.data >= de && x.data <= ate) n[weekday(x.data)]++;
    return n;
  };

  // Valores da tabela "1.º/2.º/3.º PERÍODO" da 2.ª página do calendário. Na
  // 6.ª feira do 1.º período, as colunas mensais do secundário dão 1+5+4+2 = 12
  // (sextas 25/09, 2 a 30/10, 6 a 27/11, 4 e 11/12); o total "13" impresso é
  // o do básico, que começa a 15/09 e conta também a sexta 18/09.
  it('1.º período: 12, 11, 12, 12, 12', () => {
    expect(contar(11, '2026-09-21', '2026-12-15')).toEqual([12, 11, 12, 12, 12]);
  });
  it('2.º período: 10, 10, 10, 11, 11', () => {
    expect(contar(11, '2027-01-04', '2027-03-19')).toEqual([10, 10, 10, 11, 11]);
  });
  it('3.º período: 9, 9, 9, 8, 9 até 4/6 (11.º e 12.º) e 10, 10, 10, 8, 10 até 11/6 (10.º)', () => {
    expect(contar(11, '2027-04-05', '2027-06-30')).toEqual([9, 9, 9, 8, 9]);
    expect(contar(10, '2027-04-05', '2027-06-30')).toEqual([10, 10, 10, 8, 10]);
  });
});

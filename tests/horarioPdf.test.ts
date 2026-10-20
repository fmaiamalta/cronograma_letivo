import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { blocosDaPagina } from '../src/lib/horarioPdf';

// Horário de um professor exportado do Untis (só a tabela, sem nomes).
const { itens, segmentos } = JSON.parse(readFileSync(new URL('./fixtures/horario-untis.json', import.meta.url), 'utf8'));

const resumo = (b: { dia: number; inicio: string; fim: string; titulo: string; turmas: string[]; sala?: string }) =>
  `${'STQQS'[b.dia]} ${b.inicio}-${b.fim} ${b.titulo} ${b.turmas.join('+')} ${b.sala ?? ''}`.trim();

describe('horário em PDF (Untis)', () => {
  it('lê cada quadrado com as horas que ocupa', () => {
    expect(blocosDaPagina(itens, segmentos).map(resumo)).toEqual([
      'S 08:15-10:05 H.C.A. 11A EQ28',
      'S 10:25-12:15 H.C.A. 10A EQ16E',
      'S 12:25-13:15 H.C.A. 12MM EQ20',
      'S 14:30-16:20 H.C.A. 10MM EQ02',
      'T 08:15-09:05 Hist. 7A EQ EQ24',
      'T 09:15-10:05 Hist. 7A EQ EQ24',
      'T 10:25-11:15 BIBLEQ',
      'T 11:25-13:15 H.C.A. 10A EQ15E',
      'Q 08:15-10:05 Coord DT 3º ci',
      'Q 11:25-13:15 H.C.A. 11A EQ28',
      'Q 14:30-15:20 Reuniões',
      'Q 08:15-10:05 H.C.A. 10A EQ09',
      'Q 10:25-11:15 H.C.A. 10MM EQ14',
      'Q 11:25-13:15 H.C.A. 11A EQ28',
      'S 08:15-10:05 H.C.A. 12MM EQ20',
      'S 10:25-11:15 Hist. 7A EQ EQ24',
    ]);
  });

  it('não confunde outros PDFs com um horário', () => {
    expect(blocosDaPagina([{ x: 10, y: 700, w: 50, s: 'Calendário escolar', p: 1 }], [])).toEqual([]);
  });
});

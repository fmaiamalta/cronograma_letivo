import { uid } from './dates';
import type { ItemPDF } from './pdfLayout';
import { juntar, linhasDeItens } from './pdfLayout';
import type { Bloco } from './types';

// Horário em PDF (ex.: Untis): os dias em cima, as horas à esquerda e cada
// aula num quadrado. As linhas à volta de cada quadrado dizem quantos tempos
// ocupa a aula; o texto lá dentro diz a disciplina, a turma e a sala.

/** Um traço do desenho do PDF (as linhas da tabela). */
export interface Segmento {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  p: number;
}

const DIAS: [RegExp, number][] = [
  [/^(segunda|2\.?ª|seg)/i, 0],
  [/^(ter[cç]a|3\.?ª|ter)/i, 1],
  [/^(quarta|4\.?ª|qua)/i, 2],
  [/^(quinta|5\.?ª|qui)/i, 3],
  [/^(sexta|6\.?ª|sex)/i, 4],
  [/^(s[aá]bado|s[aá]b)/i, 5],
];

const HORA = /^(\d{1,2})[:h.](\d{2})$/;

function hhmm(s: string): string {
  const m = s.match(HORA)!;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

interface Coluna { dia: number; x0: number; x1: number }
interface Linha { inicio: string; fim: string; y: number }

/** Junta valores próximos (traços duplicados ou desenhados por dentro do quadrado). */
function agrupar(valores: number[], tol = 1.6): number[] {
  const ord = [...valores].sort((a, b) => b - a);
  const out: number[] = [];
  for (const v of ord) if (!out.length || out[out.length - 1] - v > tol) out.push(v);
  return out;
}

/** Lê os blocos de uma página. Devolve [] se a página não parecer um horário. */
export function blocosDaPagina(itens: ItemPDF[], segmentos: Segmento[]): Bloco[] {
  // Cabeçalho dos dias: a linha com mais nomes de dias.
  const cabecalhos = itens
    .map((it) => ({ it, dia: DIAS.find(([re]) => re.test(it.s.trim()))?.[1] }))
    .filter((x): x is { it: ItemPDF; dia: number } => x.dia !== undefined);
  const porLinha = new Map<number, typeof cabecalhos>();
  for (const c of cabecalhos) {
    const k = Math.round(c.it.y);
    porLinha.set(k, [...(porLinha.get(k) ?? []), c]);
  }
  const cab = [...porLinha.values()].sort((a, b) => b.length - a.length)[0];
  if (!cab || cab.length < 3) return [];
  const yCab = cab[0].it.y;
  const centros = cab.map((c) => ({ dia: c.dia, cx: c.it.x + c.it.w / 2 })).sort((a, b) => a.cx - b.cx);
  const passo = (centros[centros.length - 1].cx - centros[0].cx) / Math.max(1, centros.length - 1);
  const colunas: Coluna[] = centros.map((c) => ({ dia: c.dia, x0: c.cx - passo / 2, x1: c.cx + passo / 2 }));
  const esquerda = colunas[0].x0;

  // Horas à esquerda: pares início/fim, um por tempo ("8:15" sobre "9:05", ou "8:15 - 9:05").
  const horas = itens.filter((it) => it.y < yCab && it.x + it.w <= esquerda + 2).sort((a, b) => b.y - a.y);
  const linhas: Linha[] = [];
  for (let i = 0; i < horas.length; i++) {
    const s = horas[i].s.trim();
    const dupla = s.match(/^(\d{1,2}[:h.]\d{2})\s*[-–]\s*(\d{1,2}[:h.]\d{2})$/);
    if (dupla) { linhas.push({ inicio: hhmm(dupla[1]), fim: hhmm(dupla[2]), y: horas[i].y }); continue; }
    const seg = horas[i + 1];
    if (HORA.test(s) && seg && HORA.test(seg.s.trim()) && horas[i].y - seg.y < 15) {
      linhas.push({ inicio: hhmm(s), fim: hhmm(seg.s.trim()), y: (horas[i].y + seg.y) / 2 });
      i++;
    }
  }
  if (linhas.length < 2) return [];
  const topo = Math.min(yCab - 2, linhas[0].y + 25);
  const fundo = linhas[linhas.length - 1].y - 25;

  const horizontais = segmentos.filter((s) => Math.abs(s.y1 - s.y2) < 0.6 && Math.abs(s.x1 - s.x2) > 5);
  const blocos: Bloco[] = [];
  for (const col of colunas) {
    const largura = col.x1 - col.x0;
    // Traços da largura de uma coluna: os lados de cada quadrado (a grelha toda fica de fora).
    const lados = horizontais
      .filter((s) => {
        const a = Math.min(s.x1, s.x2), b = Math.max(s.x1, s.x2);
        const meio = (a + b) / 2;
        return meio > col.x0 && meio < col.x1 && b - a < largura * 1.25 && b - a > largura * 0.6;
      })
      .map((s) => s.y1);
    const limites = agrupar([topo, ...lados.filter((y) => y < topo && y > fundo), fundo]);
    // Sem traços por coluna: cada tempo é um quadrado.
    const fronteiras = lados.length ? limites : agrupar([topo, ...linhas.slice(0, -1).map((l, i) => (l.y + linhas[i + 1].y) / 2), fundo]);
    for (let k = 0; k + 1 < fronteiras.length; k++) {
      const [cima, baixo] = [fronteiras[k], fronteiras[k + 1]];
      const dentro = itens.filter((it) => it.y < cima && it.y > baixo && it.x >= col.x0 - 2 && it.x + it.w / 2 <= col.x1);
      if (!dentro.length) continue;
      const tempos = linhas.filter((l) => l.y < cima && l.y > baixo);
      if (!tempos.length) continue;
      const b = blocoDoQuadrado(dentro, col.x0 + largura / 2);
      if (!b) continue;
      blocos.push({ id: uid(), dia: col.dia, inicio: tempos[0].inicio, fim: tempos[tempos.length - 1].fim, ...b });
    }
  }
  return blocos.sort((a, b) => a.dia - b.dia || a.inicio.localeCompare(b.inicio));
}

/** Notas que não são turma nem sala ("2sem" = só no 2.º semestre). */
const NOTA = /^\d\.?\s*º?\s*sem(estre)?$|^(quinzenal|q\d)$/i;

/**
 * Texto de um quadrado: 1.ª linha = disciplina; à direita, em baixo = sala;
 * o resto à esquerda = turma. Uma só linha (sem turma) = outra atividade.
 */
function blocoDoQuadrado(itens: ItemPDF[], meio: number): Pick<Bloco, 'titulo' | 'turmas' | 'sala'> | null {
  const linhas = linhasDeItens(itens).map((l) => l.filter((it) => !NOTA.test(it.s.trim()))).filter((l) => l.length);
  if (!linhas.length) return null;
  const titulo = juntar(linhas[0]).replace(/\s+/g, ' ').trim();
  if (linhas.length === 1) return { titulo, turmas: [] };
  const resto = linhas.slice(1).flat();
  const ultima = linhas[linhas.length - 1];
  const direita = ultima.filter((it) => it.x > meio);
  const sala = direita.length && linhas.length > 2 ? juntar(direita) : direita.length && ultima.length > 1 ? juntar(direita) : undefined;
  const turmasTxt = juntar(resto.filter((it) => !direita.includes(it)));
  const turmas = turmasTxt.split(/\s*[,;/]\s*/).map((t) => t.trim()).filter(Boolean);
  // Sem turma, a sala sozinha também pode ser a turma: se não parecer sala, fica turma.
  if (!turmas.length && sala) return { titulo, turmas: [sala] };
  return { titulo, turmas, sala };
}

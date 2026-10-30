import { addDays, inRange, weekday } from './dates';
import { ensinoDe, fimDoAno, minutosDe, tiraODia, type Ausencia, type CalendarioEscolar, type Disciplina, type ISODate, type Modulo, type PeriodoTurma } from './types';

export interface DiaDeAula {
  data: ISODate;
  tempos: number;
}

export interface Sessao {
  data: ISODate;
  tempos: number;
}

export interface PlanoModulo {
  modulo: Modulo;
  totalTempos: number;
  sessoes: Sessao[];
  inicio?: ISODate;
  fim?: ISODate;
  /** Tempos já dados até hoje (inclusive). */
  dados: number;
  /** Tempos que não cabem até ao fim do ano letivo. */
  emFalta: number;
}

export interface PlanoDisciplina {
  disciplina: Disciplina;
  inicio: ISODate;
  fim: ISODate;
  dias: DiaDeAula[];
  modulos: PlanoModulo[];
  temposDisponiveis: number;
  temposNecessarios: number;
}

export function temposDoModulo(m: Pick<Modulo, 'quantidade' | 'unidade'>, minutosPorTempo: number): number {
  if (!(m.quantidade > 0)) return 0;
  return m.unidade === 't' ? Math.round(m.quantidade) : Math.round((m.quantidade * 60) / minutosPorTempo);
}

export function horasParaTempos(horas: number, minutosPorTempo: number): number {
  return Math.round((horas * 60) / minutosPorTempo);
}

/** Motivo pelo qual um dia não tem aula, ou null se é dia letivo para esta turma. */
export function motivoSemAula(
  data: ISODate,
  cal: CalendarioEscolar,
  turma: string,
  periodosTurma: PeriodoTurma[],
  diasSemAula: ISODate[] = [],
  ausencias: Ausencia[] = [],
  disciplinaId?: string,
): string | null {
  for (const i of cal.interrupcoes) if (inRange(data, i.inicio, i.fim)) return i.nome;
  for (const f of cal.feriados) if (f.data === data) return f.nome;
  for (const p of periodosTurma) if (p.turma === turma && inRange(data, p.inicio, p.fim)) return p.nome;
  for (const a of ausencias) if (tiraODia(a, disciplinaId) && inRange(data, a.inicio, a.fim)) return a.nome;
  if (diasSemAula.includes(data)) return 'Sem aula';
  return null;
}

export function limitesDisciplina(d: Disciplina, cal: CalendarioEscolar): { inicio: ISODate; fim: ISODate } {
  const inicioNivel = cal.inicioPorEnsino?.[ensinoDe(d)] ?? cal.inicio;
  const inicio = d.inicio && d.inicio > inicioNivel ? d.inicio : inicioNivel;
  const fimAno = fimDoAno(cal, d.ano);
  const fim = d.fim && d.fim < fimAno ? d.fim : fimAno;
  return { inicio, fim };
}

export function diasDeAula(d: Disciplina, cal: CalendarioEscolar, periodosTurma: PeriodoTurma[], ausencias: Ausencia[] = []): DiaDeAula[] {
  const { inicio, fim } = limitesDisciplina(d, cal);
  const dias: DiaDeAula[] = [];
  if (!d.tempos.some((t) => t > 0)) return dias;
  for (let data = inicio; data <= fim; data = addDays(data, 1)) {
    const tempos = d.tempos[weekday(data)] ?? 0;
    if (tempos <= 0) continue;
    if (motivoSemAula(data, cal, d.turma, periodosTurma, d.diasSemAula, ausencias, d.id)) continue;
    // Só alguns tempos perdidos nesse dia (ex.: 1 dos 2): no profissional, o módulo avança só esses.
    const perdidos = ausencias.filter((a) => a.disciplinaId === d.id && a.tempos && a.inicio === data).reduce((s, a) => s + a.tempos!, 0);
    if (tempos - perdidos <= 0) continue;
    dias.push({ data, tempos: tempos - perdidos });
  }
  return dias;
}

/**
 * Distribui os módulos, por ordem, pelos dias de aula. Quando um módulo
 * termina a meio de um dia, o seguinte começa nesse mesmo dia.
 */
export function planear(
  d: Disciplina,
  cal: CalendarioEscolar,
  periodosTurma: PeriodoTurma[],
  hoje: ISODate,
  ausencias: Ausencia[] = [],
): PlanoDisciplina {
  const { inicio, fim } = limitesDisciplina(d, cal);
  // Um dia perdido (falta, greve) não apaga tempos: o módulo continua nas aulas seguintes.
  const dias = diasDeAula(d, cal, periodosTurma, ausencias);
  const temposAno = dias.reduce((s, x) => s + x.tempos, 0);
  const modulos: PlanoModulo[] = d.modulos.map((modulo) => ({
    modulo,
    // Disciplina anual (ensino geral): ocupa todas as aulas do ano.
    totalTempos: modulo.anual ? temposAno : temposDoModulo(modulo, minutosDe(d, cal)),
    sessoes: [],
    dados: 0,
    emFalta: 0,
  }));

  let mi = 0;
  let restante = modulos[0]?.totalTempos ?? 0;
  const avancar = () => {
    mi++;
    restante = modulos[mi]?.totalTempos ?? 0;
  };
  while (mi < modulos.length && restante === 0) avancar();

  for (const dia of dias) {
    let livres = dia.tempos;
    while (livres > 0 && mi < modulos.length) {
      const usados = Math.min(livres, restante);
      modulos[mi].sessoes.push({ data: dia.data, tempos: usados });
      livres -= usados;
      restante -= usados;
      while (mi < modulos.length && restante === 0) avancar();
    }
    if (mi >= modulos.length) break;
  }

  for (const pm of modulos) {
    pm.inicio = pm.sessoes[0]?.data;
    pm.fim = pm.sessoes[pm.sessoes.length - 1]?.data;
    const marcados = pm.sessoes.reduce((s, x) => s + x.tempos, 0);
    pm.emFalta = pm.totalTempos - marcados;
    pm.dados = pm.sessoes.filter((s) => s.data <= hoje).reduce((s, x) => s + x.tempos, 0);
  }

  return {
    disciplina: d,
    inicio,
    fim,
    dias,
    modulos,
    temposDisponiveis: dias.reduce((s, x) => s + x.tempos, 0),
    temposNecessarios: modulos.reduce((s, x) => s + x.totalTempos, 0),
  };
}

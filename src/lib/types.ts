/** Datas sempre no formato ISO "AAAA-MM-DD", sem horas nem fuso. */
export type ISODate = string;

export type Componente = 'sociocultural' | 'cientifica' | 'tecnologica' | 'fct';

export const COMPONENTES: { id: Componente; nome: string }[] = [
  { id: 'sociocultural', nome: 'Sociocultural' },
  { id: 'cientifica', nome: 'Científica' },
  { id: 'tecnologica', nome: 'Tecnológica' },
  { id: 'fct', nome: 'Contexto de Trabalho' },
];

export type Ano = 10 | 11 | 12;

export interface Periodo {
  id: string;
  nome: string;
  inicio: ISODate;
  fim: ISODate;
}

export interface Feriado {
  id: string;
  data: ISODate;
  nome: string;
}

export interface CalendarioEscolar {
  anoLetivo: string; // "2026/2027"
  escola: string;
  inicio: ISODate;
  fimPorAno: Record<Ano, ISODate>;
  interrupcoes: Periodo[];
  feriados: Feriado[];
  /** Duração de um tempo letivo, em minutos. */
  minutosPorTempo: number;
  /** Nome do ficheiro de onde veio, se foi importado. */
  importadoDe?: string;
}

export interface EntradaCatalogo {
  codigo: string;
  nome: string;
  horas: number;
  pontos?: number;
  componente: Componente;
  qualificacao?: string;
  opcional?: boolean;
  /** Módulo sem código, criado à mão no horário (ex.: "Base 1 · Pesquisar..."). */
  modulo?: boolean;
  /** Criado à mão no horário (não veio de um referencial): pode ser atualizado. */
  manual?: boolean;
}

export interface Tarefa {
  id: string;
  titulo: string;
  descricao?: string;
  /** Dia da tarefa, ou início de um período. */
  data?: ISODate;
  /** Fim do período (só nas tarefas com início e fim). */
  fim?: ISODate;
  feita: boolean;
}

/** Último dia de uma tarefa: o fim do período ou o próprio dia. */
export function prazo(t: Tarefa): ISODate | undefined {
  return t.fim ?? t.data;
}

export interface Modulo {
  id: string;
  codigo?: string;
  nome: string;
  quantidade: number;
  unidade: 'h' | 't'; // horas ou tempos
  tarefas: Tarefa[];
}

/** Uma disciplina dada pelo professor a uma turma. */
export interface Disciplina {
  id: string;
  turma: string;
  nome: string;
  ano: Ano;
  componente: Componente;
  cor: string;
  /** Tempos por dia da semana, índice 0 = segunda ... 6 = domingo. */
  tempos: number[];
  inicio?: ISODate;
  fim?: ISODate;
  /** Dias concretos sem aula (visita de estudo, greve, reunião). */
  diasSemAula: ISODate[];
  modulos: Modulo[];
}

/** Períodos em que a turma inteira não tem aulas (FCT, intercâmbio). */
export interface PeriodoTurma extends Periodo {
  turma: string;
}

export interface Estado {
  versao: 1;
  calendario: CalendarioEscolar;
  disciplinas: Disciplina[];
  periodosTurma: PeriodoTurma[];
  catalogo: EntradaCatalogo[];
}

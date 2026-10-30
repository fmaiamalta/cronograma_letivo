/** Datas sempre no formato ISO "AAAA-MM-DD", sem horas nem fuso. */
export type ISODate = string;

export type Componente =
  // Ensino profissional
  | 'sociocultural' | 'cientifica' | 'tecnologica' | 'fct'
  // Ensino básico
  | 'linguas' | 'matcien' | 'expressoes' | 'outras'
  // Ensino secundário científico-humanístico
  | 'geral' | 'especifica' | 'transversal';

export type Ensino = 'profissional' | 'basico' | 'secundario';

export const ENSINOS: { id: Ensino; nome: string; anos: Ano[] }[] = [
  { id: 'profissional', nome: 'Profissional', anos: [10, 11, 12] },
  { id: 'basico', nome: 'Básico', anos: [5, 6, 7, 8, 9] },
  { id: 'secundario', nome: 'Secundário (científico-humanístico)', anos: [10, 11, 12] },
];

export const ANOS: Ano[] = [5, 6, 7, 8, 9, 10, 11, 12];

export const COMPONENTES: { id: Componente; nome: string; ensino: Ensino }[] = [
  { id: 'sociocultural', nome: 'Sociocultural', ensino: 'profissional' },
  { id: 'cientifica', nome: 'Científica', ensino: 'profissional' },
  { id: 'tecnologica', nome: 'Tecnológica', ensino: 'profissional' },
  { id: 'fct', nome: 'Contexto de Trabalho', ensino: 'profissional' },
  { id: 'linguas', nome: 'Línguas e Estudos Sociais', ensino: 'basico' },
  { id: 'matcien', nome: 'Matemática e Ciências', ensino: 'basico' },
  { id: 'expressoes', nome: 'Expressões e Tecnologias', ensino: 'basico' },
  { id: 'outras', nome: 'Outras', ensino: 'basico' },
  { id: 'geral', nome: 'Formação Geral', ensino: 'secundario' },
  { id: 'especifica', nome: 'Formação Específica', ensino: 'secundario' },
  { id: 'transversal', nome: 'Transversal / Opcional', ensino: 'secundario' },
];

export type Ano = 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

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
  /** Fim das aulas por ano de escolaridade (os anos em falta usam o mais tardio). */
  fimPorAno: Partial<Record<Ano, ISODate>>;
  /** Início das aulas por nível, quando difere do início geral (ex.: secundário a 21/09). */
  inicioPorEnsino?: Partial<Record<Ensino, ISODate>>;
  interrupcoes: Periodo[];
  feriados: Feriado[];
  /** Horas de início dos tempos da escola ("08:15", "09:15", "10:25", ...). */
  horasTempos?: string[];
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
  /** Ensino geral: a disciplina inteira, que ocupa todas as aulas do ano. */
  anual?: boolean;
}

/** Uma disciplina dada pelo professor a uma turma. */
export interface Disciplina {
  id: string;
  turma: string;
  nome: string;
  ano: Ano;
  /** Sem valor = profissional (dados antigos). */
  ensino?: Ensino;
  componente: Componente;
  cor: string;
  /** Tempos por dia da semana, índice 0 = segunda ... 6 = domingo. */
  tempos: number[];
  inicio?: ISODate;
  fim?: ISODate;
  /**
   * Minutos que cada tempo conta para as horas dos módulos (ex.: aulas de 50 min
   * que contam 60). Sem valor: a duração do tempo no calendário.
   */
  minutosPorTempo?: number;
  /** Aulas da semana, com hora. Com aulas, os tempos por dia saem daqui. */
  aulas?: Aula[];
  /** Dias concretos sem aula (visita de estudo, greve, reunião). */
  diasSemAula: ISODate[];
  modulos: Modulo[];
}

/**
 * Dias sem aulas em todas as disciplinas (greve, doença, formação). Valem para
 * todas as disciplinas; no profissional, os módulos passam para as aulas seguintes.
 */
export interface Ausencia extends Periodo {
  /** Só esta disciplina (sem valor: todas). */
  disciplinaId?: string;
  /** Só estes tempos da disciplina nesse dia (sem valor: o dia todo). */
  tempos?: number;
  /** Hora do primeiro tempo perdido, para riscar os tempos certos no horário. */
  hora?: string;
}

/** A ausência tira o dia inteiro a esta disciplina? (As de outra disciplina e as de alguns tempos, não.) */
export function tiraODia(a: Ausencia, disciplinaId?: string): boolean {
  return !a.disciplinaId || (a.disciplinaId === disciplinaId && !a.tempos);
}

export const MOTIVOS_AUSENCIA = ['Greve', 'Doença', 'Formação', 'Serviço oficial', 'Visita de estudo', 'Prova', 'Reunião', 'Outro'];

/** Aula semanal de uma disciplina: dia, hora de início e tempos seguidos. */
export interface Aula {
  id: string;
  /** 0 = segunda ... 6 = domingo */
  dia: number;
  /** "HH:MM" */
  inicio: string;
  tempos: number;
  sala?: string;
}

/** Horas do professor que não são aulas (Equipa TIC, apoio, reuniões). */
export interface Atividade {
  id: string;
  nome: string;
  dia: number;
  inicio: string;
  fim: string;
  sala?: string;
}

/** Um bloco do horário semanal (uma aula, uma reunião, ...). */
export interface Bloco {
  id: string;
  /** 0 = segunda ... 6 = domingo */
  dia: number;
  /** "HH:MM" */
  inicio: string;
  fim: string;
  /** Nome da disciplina ou da atividade ("Equipa TIC", "Reuniões"). */
  titulo: string;
  /** Sem turmas = não é aula (não conta tempos). */
  turmas: string[];
  sala?: string;
  /** Tempos que o bloco ocupa, quando o ficheiro o diz (PDF); senão conta-se pela duração. */
  tempos?: number;
  /** Bloco posto à mão: ligado diretamente a esta disciplina. */
  disciplinaId?: string;
}

export interface HorarioSemanal {
  blocos: Bloco[];
  /** Nome do ficheiro importado. */
  origem?: string;
  importado?: ISODate;
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
  /** Sem valor em dados antigos. */
  ausencias?: Ausencia[];
  /** Grelha importada (versões antigas). Agora o horário sai das aulas de cada disciplina. */
  horario?: HorarioSemanal;
  /** Outras horas do horário (Equipa TIC, apoio, reuniões). */
  atividades?: Atividade[];
  catalogo: EntradaCatalogo[];
}

export function ensinoDe(d: { ensino?: Ensino }): Ensino {
  return d.ensino ?? 'profissional';
}

/** Ensino geral (básico ou secundário): disciplina anual, sem módulos. */
/** Minutos que um tempo desta disciplina conta para as horas dos módulos. */
export function minutosDe(d: Pick<Disciplina, 'minutosPorTempo'>, cal: Pick<CalendarioEscolar, 'minutosPorTempo'>): number {
  return d.minutosPorTempo ?? cal.minutosPorTempo;
}

export function ehGeral(d: { ensino?: Ensino }): boolean {
  return ensinoDe(d) !== 'profissional';
}

/** Fim das aulas de um ano; se o calendário não o tiver, o mais tardio dos que tem. */
export function fimDoAno(cal: { fimPorAno: Partial<Record<Ano, ISODate>> }, ano: Ano): ISODate {
  return cal.fimPorAno[ano] ?? Object.values(cal.fimPorAno).reduce((a, b) => (b! > a! ? b : a))!;
}

/**
 * Dados antigos: os "dias sem aula desta disciplina" passam para Sem aulas,
 * como ausências dessa disciplina (o dia todo). Pode correr várias vezes.
 */
export function migrarDiasSemAula(e: Estado): Estado {
  if (!e.disciplinas.some((d) => d.diasSemAula?.length)) return e;
  const novas: Ausencia[] = e.disciplinas.flatMap((d) =>
    (d.diasSemAula ?? []).map((data) => ({ id: `dsa-${d.id}-${data}`, nome: 'Sem aula', inicio: data, fim: data, disciplinaId: d.id })),
  );
  const ids = new Set((e.ausencias ?? []).map((a) => a.id));
  return {
    ...e,
    ausencias: [...(e.ausencias ?? []), ...novas.filter((a) => !ids.has(a.id))],
    disciplinas: e.disciplinas.map((d) => (d.diasSemAula?.length ? { ...d, diasSemAula: [] } : d)),
  };
}

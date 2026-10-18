import type { Ano, Componente } from '../lib/types';

export interface DisciplinaBase {
  nome: string;
  componente: Componente;
}

/**
 * Disciplinas que não vêm do catálogo. Na componente tecnológica o nome da
 * disciplina é escrito por quem preenche e as UC escolhem-se do referencial.
 */
export const DISCIPLINAS_ESCOLA: DisciplinaBase[] = [
  { nome: 'Formação em Contexto de Trabalho', componente: 'fct' },
];

export interface DisciplinaGeral extends DisciplinaBase {
  anos: Ano[];
  /** Subgrupo dentro da componente (ex.: "Trienal"). */
  grupo?: string;
}

const B2 = [5, 6] as Ano[];
const B3 = [7, 8, 9] as Ano[];
const BAS = [5, 6, 7, 8, 9] as Ano[];
const S10_11 = [10, 11] as Ano[];
const SEC = [10, 11, 12] as Ano[];

/** Matriz do ensino básico (2.º e 3.º ciclos). */
export const DISCIPLINAS_BASICO: DisciplinaGeral[] = [
  { nome: 'Português', componente: 'linguas', anos: BAS },
  { nome: 'Inglês', componente: 'linguas', anos: BAS },
  { nome: 'História e Geografia de Portugal', componente: 'linguas', anos: B2 },
  { nome: 'História', componente: 'linguas', anos: B3 },
  { nome: 'Geografia', componente: 'linguas', anos: B3 },
  { nome: 'Francês (LE II)', componente: 'linguas', anos: B3 },
  { nome: 'Espanhol (LE II)', componente: 'linguas', anos: B3 },
  { nome: 'Alemão (LE II)', componente: 'linguas', anos: B3 },
  { nome: 'Matemática', componente: 'matcien', anos: BAS },
  { nome: 'Ciências Naturais', componente: 'matcien', anos: BAS },
  { nome: 'Físico-Química', componente: 'matcien', anos: B3 },
  { nome: 'Educação Visual', componente: 'expressoes', anos: BAS },
  { nome: 'Educação Tecnológica', componente: 'expressoes', anos: [5, 6, 7, 8] },
  { nome: 'Educação Musical', componente: 'expressoes', anos: B2 },
  { nome: 'Tecnologias da Informação e Comunicação', componente: 'expressoes', anos: BAS },
  { nome: 'Educação Física', componente: 'outras', anos: BAS },
  { nome: 'Cidadania e Desenvolvimento', componente: 'outras', anos: BAS },
  { nome: 'Educação Moral e Religiosa', componente: 'outras', anos: BAS },
];

/** Cursos científico-humanísticos. A formação específica depende do curso. */
export const DISCIPLINAS_SECUNDARIO: DisciplinaGeral[] = [
  { nome: 'Português', componente: 'geral', anos: SEC },
  { nome: 'Inglês', componente: 'geral', anos: S10_11 },
  { nome: 'Francês', componente: 'geral', anos: S10_11 },
  { nome: 'Espanhol', componente: 'geral', anos: S10_11 },
  { nome: 'Alemão', componente: 'geral', anos: S10_11 },
  { nome: 'Filosofia', componente: 'geral', anos: S10_11 },
  { nome: 'Educação Física', componente: 'geral', anos: SEC },
  ...['Matemática A', 'História A', 'Desenho A'].map((nome) => ({ nome, componente: 'especifica' as const, anos: SEC, grupo: 'Trienal' })),
  ...[
    'Física e Química A', 'Biologia e Geologia', 'Economia A', 'Geometria Descritiva A', 'Geografia A',
    'Matemática Aplicada às Ciências Sociais', 'Literatura Portuguesa', 'História da Cultura e das Artes',
  ].map((nome) => ({ nome, componente: 'especifica' as const, anos: S10_11, grupo: 'Bienal' })),
  ...[
    'Aplicações Informáticas B', 'Biologia', 'Física', 'Geologia', 'Química', 'Psicologia B', 'Sociologia', 'Filosofia A',
    'Economia C', 'Geografia C', 'Direito', 'Antropologia', 'Ciência Política', 'Clássicos da Literatura',
    'Oficina de Artes', 'Oficina Multimédia B', 'Materiais e Tecnologias',
  ].map((nome) => ({ nome, componente: 'especifica' as const, anos: [12] as Ano[], grupo: 'Anual (12.º)' })),
  { nome: 'Cidadania e Desenvolvimento', componente: 'transversal', anos: SEC },
  { nome: 'Educação Moral e Religiosa', componente: 'transversal', anos: SEC },
];

import type { Componente } from '../lib/types';

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

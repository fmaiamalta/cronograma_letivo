import type { Componente } from '../lib/types';

export interface DisciplinaBase {
  nome: string;
  componente: Componente;
}

/**
 * Disciplinas que não vêm como disciplina no referencial: na componente
 * tecnológica o referencial só tem UC, mas as escolas agrupam-nas nestas
 * disciplinas. As restantes (Português, Matemática, ...) vêm do catálogo.
 */
export const DISCIPLINAS_ESCOLA: DisciplinaBase[] = [
  { nome: 'Design, Comunicação e Audiovisuais', componente: 'tecnologica' },
  { nome: 'Projeto e Produção Multimédia', componente: 'tecnologica' },
  { nome: 'Sistemas de Informação', componente: 'tecnologica' },
  { nome: 'Técnicas de Multimédia', componente: 'tecnologica' },
  { nome: 'Formação em Contexto de Trabalho', componente: 'fct' },
];

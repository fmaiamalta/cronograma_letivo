import type { Componente } from '../lib/types';

export interface DisciplinaBase {
  nome: string;
  componente: Componente;
}

/**
 * Disciplinas dos cursos profissionais, por componente de formação. Ao escolher
 * uma, a componente fica preenchida.
 */
export const DISCIPLINAS: DisciplinaBase[] = [
  // Sociocultural
  { nome: 'Português', componente: 'sociocultural' },
  { nome: 'Inglês', componente: 'sociocultural' },
  { nome: 'Francês', componente: 'sociocultural' },
  { nome: 'Espanhol', componente: 'sociocultural' },
  { nome: 'Alemão', componente: 'sociocultural' },
  { nome: 'Área de Integração', componente: 'sociocultural' },
  { nome: 'Educação Física', componente: 'sociocultural' },
  { nome: 'Tecnologias da Informação e Comunicação', componente: 'sociocultural' },
  { nome: 'Cidadania e Desenvolvimento', componente: 'sociocultural' },
  { nome: 'Educação Moral e Religiosa', componente: 'sociocultural' },
  { nome: 'Oferta de Escola', componente: 'sociocultural' },
  // Científica
  { nome: 'Matemática', componente: 'cientifica' },
  { nome: 'Física e Química', componente: 'cientifica' },
  { nome: 'Física', componente: 'cientifica' },
  { nome: 'Química', componente: 'cientifica' },
  { nome: 'Biologia', componente: 'cientifica' },
  { nome: 'Geologia', componente: 'cientifica' },
  { nome: 'História da Cultura e das Artes', componente: 'cientifica' },
  { nome: 'Economia', componente: 'cientifica' },
  { nome: 'Geografia', componente: 'cientifica' },
  { nome: 'Psicologia', componente: 'cientifica' },
  { nome: 'Sociologia', componente: 'cientifica' },
  // Tecnológica
  { nome: 'Design, Comunicação e Audiovisuais', componente: 'tecnologica' },
  { nome: 'Projeto e Produção Multimédia', componente: 'tecnologica' },
  { nome: 'Sistemas de Informação', componente: 'tecnologica' },
  { nome: 'Técnicas de Multimédia', componente: 'tecnologica' },
  // Contexto de trabalho
  { nome: 'Formação em Contexto de Trabalho', componente: 'fct' },
];

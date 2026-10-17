import { uid } from './dates';
import type { CalendarioEscolar, Disciplina, Estado, Modulo, PeriodoTurma } from './types';
import catalogoMultimedia from '../data/catalogo-multimedia.json';
import type { EntradaCatalogo } from './types';

export const CATALOGO_BASE = catalogoMultimedia as EntradaCatalogo[];

/**
 * Calendário nacional 2026/2027 (Despacho 8368/2024, alterado pelo Despacho
 * 10430/2026). O início e as datas de fim dependem da escola: confirma-as.
 */
export function calendario2026(): CalendarioEscolar {
  const f = (data: string, nome: string) => ({ id: uid(), data, nome });
  return {
    anoLetivo: '2026/2027',
    escola: '',
    inicio: '2026-09-15',
    fimPorAno: { 10: '2027-06-11', 11: '2027-06-04', 12: '2027-06-04' },
    interrupcoes: [
      { id: uid(), nome: 'Natal', inicio: '2026-12-16', fim: '2026-12-31' },
      { id: uid(), nome: 'Carnaval', inicio: '2027-02-08', fim: '2027-02-10' },
      { id: uid(), nome: 'Páscoa', inicio: '2027-03-22', fim: '2027-04-02' },
    ],
    feriados: [
      f('2026-10-05', 'Implantação da República'),
      f('2026-11-01', 'Todos os Santos'),
      f('2026-12-01', 'Restauração da Independência'),
      f('2026-12-08', 'Imaculada Conceição'),
      f('2027-01-01', 'Ano Novo'),
      f('2027-03-26', 'Sexta-feira Santa'),
      f('2027-04-25', 'Dia da Liberdade'),
      f('2027-05-01', 'Dia do Trabalhador'),
      f('2027-05-27', 'Corpo de Deus'),
      f('2027-06-10', 'Dia de Portugal'),
    ],
    minutosPorTempo: 50,
  };
}

export function estadoInicial(): Estado {
  return {
    versao: 1,
    calendario: calendario2026(),
    disciplinas: [],
    periodosTurma: [],
    catalogo: CATALOGO_BASE,
  };
}

export const CORES = ['#a0522d', '#d9893f', '#1b6b7a', '#5aa9b8', '#2f7d4f', '#7fb98f', '#5b3f8c', '#a68fcf', '#b2456e', '#6b7280'];

function mod(nome: string, quantidade: number, unidade: 'h' | 't', codigo?: string): Modulo {
  return { id: uid(), nome, quantidade, unidade, codigo, tarefas: [] };
}

/** Horário fictício de um professor, para experimentar a app. */
export function exemplo(): Pick<Estado, 'disciplinas' | 'periodosTurma'> {
  const semana = (seg = 0, ter = 0, qua = 0, qui = 0, sex = 0) => [seg, ter, qua, qui, sex, 0, 0];
  const disciplinas: Disciplina[] = [
    {
      id: uid(), turma: '12.º M', nome: 'Projeto e Produção Multimédia', ano: 12, componente: 'tecnologica', cor: CORES[0],
      tempos: semana(2, 0, 2, 0, 1), diasSemAula: [],
      modulos: [
        { ...mod('Gerir um projeto multimédia', 25, 'h', 'UC02640'), tarefas: [
          { id: uid(), titulo: 'Entregar plano do projeto', data: '2026-10-14', feita: true },
          { id: uid(), titulo: 'Apresentação intermédia', data: '2026-10-28', feita: false },
        ] },
        mod('Implementar um projeto multimédia', 50, 'h', 'UC02641'),
      ],
    },
    {
      id: uid(), turma: '10.º D', nome: 'Tecnologias da Informação e Comunicação', ano: 10, componente: 'sociocultural', cor: CORES[2],
      tempos: semana(0, 2, 0, 2, 0), diasSemAula: [],
      modulos: [mod('Base 1 · Pesquisar, filtrar e estruturar', 50, 't'), mod('Base 2 · Organização e tratamento de dados', 50, 't')],
    },
    {
      id: uid(), turma: '10.º M', nome: 'Sistemas de Informação', ano: 10, componente: 'tecnologica', cor: CORES[6],
      tempos: semana(1, 0, 0, 1, 0), diasSemAula: [],
      modulos: [mod('Criar páginas para a web em hipertexto', 25, 'h', 'UC02634'), mod('Construir estilos em CSS', 25, 'h', 'UC02651')],
    },
  ];
  const periodosTurma: PeriodoTurma[] = [
    { id: uid(), turma: '12.º M', nome: 'FCT', inicio: '2027-04-19', fim: '2027-05-28' },
  ];
  return { disciplinas, periodosTurma };
}

import { uid, weekday } from './dates';
import { CORES } from './presets';
import { COMPONENTES, type Ano, type Bloco, type Disciplina, type Ensino, type Estado } from './types';

// Horário semanal: leitura do .ics (ex.: inforarios.pt) e ligação de cada
// bloco à disciplina do cronograma, para os tempos por dia saírem daqui.

function desescapar(v: string): string {
  return v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
}

function hora(v: string): { data: string; hora: string } | null {
  // 20260914T091500, 20260914T091500Z ou só a data
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
  if (!m || !m[4]) return null;
  return { data: `${m[1]}-${m[2]}-${m[3]}`, hora: `${m[4]}:${m[5]}` };
}

/** Lê os eventos de um .ics e devolve os blocos de uma semana tipo. */
export function lerHorarioICS(texto: string): Bloco[] {
  // Linhas dobradas: as que começam por espaço continuam a anterior.
  const linhas = texto.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const blocos: Bloco[] = [];
  const vistos = new Set<string>();
  let ev: Record<string, string> | null = null;
  for (const linha of linhas) {
    if (linha === 'BEGIN:VEVENT') { ev = {}; continue; }
    if (linha === 'END:VEVENT') {
      const ini = ev?.DTSTART ? hora(ev.DTSTART) : null;
      const fim = ev?.DTEND ? hora(ev.DTEND) : null;
      if (ev && ini && fim) {
        const resumo = desescapar(ev.SUMMARY ?? '').trim();
        const desc = desescapar(ev.DESCRIPTION ?? '');
        const [titulo, depois] = resumo.split(/\s+·\s+/);
        const turmasTxt = desc.match(/Turmas?:\s*(.+)/i)?.[1] ?? depois ?? '';
        const turmas = turmasTxt.split(/\s*,\s*/).map((t) => t.trim()).filter(Boolean);
        const sala = desescapar(ev.LOCATION ?? '').trim() || desc.match(/Sala:\s*(.+)/i)?.[1]?.trim() || undefined;
        const b: Bloco = { id: uid(), dia: weekday(ini.data), inicio: ini.hora, fim: fim.hora, titulo: titulo.trim(), turmas, sala };
        // Um ficheiro com cada semana em separado dá os mesmos blocos várias vezes.
        const chave = [b.dia, b.inicio, b.titulo, b.turmas.join(','), b.sala].join('|');
        if (b.titulo && !vistos.has(chave)) {
          vistos.add(chave);
          blocos.push(b);
        }
      }
      ev = null;
      continue;
    }
    if (!ev) continue;
    const i = linha.indexOf(':');
    if (i < 0) continue;
    const nome = linha.slice(0, i).split(';')[0].toUpperCase();
    ev[nome] = linha.slice(i + 1);
  }
  return blocos.sort((a, b) => a.dia - b.dia || a.inicio.localeCompare(b.inicio));
}

export function minutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function ehAula(b: Bloco): boolean {
  return b.turmas.length > 0;
}

const PEQUENAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'em', 'para']);

function semAcentos(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** "Tecnologias da Informação e da Comunicação" → "TIC"; "PPM" fica "PPM". */
export function sigla(nome: string): string {
  const palavras = semAcentos(nome).split(/[\s\-–·|]+/).filter(Boolean);
  if (palavras.length === 1) return palavras[0].toUpperCase();
  return palavras.filter((p) => !PEQUENAS.has(p.toLowerCase())).map((p) => p[0].toUpperCase()).join('');
}

function normTurma(t: string): string {
  return semAcentos(t).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Turmas juntas como no cronograma: ["12H2", "12H3"] → "12H2H3". */
export function nomeTurmas(turmas: string[]): string {
  if (turmas.length <= 1) return turmas[0] ?? '';
  const ano = turmas[0].match(/^\D*\d+/)?.[0] ?? '';
  return turmas[0] + turmas.slice(1).map((t) => (ano && t.startsWith(ano) ? t.slice(ano.length) : t)).join('');
}

function turmaCombina(turmaDisciplina: string, turmas: string[]): boolean {
  const a = normTurma(turmaDisciplina);
  if (!a) return false;
  for (const b of [nomeTurmas(turmas), turmas.join('')].map(normTurma)) {
    if (a === b) return true;
    // "D9A" no horário e "9A" no cronograma (ou ao contrário).
    const [curto, longo] = a.length < b.length ? [a, b] : [b, a];
    if (curto.length >= 2 && /\d/.test(curto) && longo.endsWith(curto) && longo.length - curto.length <= 1) return true;
  }
  return false;
}

function nomeCombina(nomeDisciplina: string, titulo: string): boolean {
  if (!nomeDisciplina.trim()) return false;
  const a = semAcentos(nomeDisciplina).toLowerCase().trim();
  const b = semAcentos(titulo).toLowerCase().trim();
  return a === b || sigla(nomeDisciplina) === sigla(titulo);
}

/** A disciplina do cronograma a que pertence um bloco do horário, se houver. */
export function disciplinaDoBloco(b: Bloco, disciplinas: Disciplina[], blocos: Bloco[]): Disciplina | undefined {
  if (b.disciplinaId) return disciplinas.find((d) => d.id === b.disciplinaId);
  if (!ehAula(b)) return undefined;
  const mesmaTurma = disciplinas.filter((d) => turmaCombina(d.turma, b.turmas));
  const porNome = mesmaTurma.find((d) => nomeCombina(d.nome, b.titulo));
  if (porNome) return porNome;
  // Sem nome que combine: serve se a turma só tem uma disciplina no horário e uma no cronograma.
  const titulos = new Set(blocos.filter((x) => ehAula(x) && turmaCombina(mesmaTurma[0]?.turma ?? '', x.turmas)).map((x) => sigla(x.titulo)));
  return mesmaTurma.length === 1 && titulos.size === 1 ? mesmaTurma[0] : undefined;
}

/** Tempos por dia da semana de cada disciplina com blocos no horário. */
export function temposDoHorario(blocos: Bloco[], disciplinas: Disciplina[], minutosPorTempo: number): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const b of blocos) {
    const d = disciplinaDoBloco(b, disciplinas, blocos);
    if (!d) continue;
    const t = out.get(d.id) ?? [0, 0, 0, 0, 0, 0, 0];
    t[b.dia] += Math.max(1, Math.round((minutos(b.fim) - minutos(b.inicio)) / minutosPorTempo));
    out.set(d.id, t);
  }
  return out;
}

/** Aulas do horário sem disciplina no cronograma, agrupadas por disciplina e turma. */
export function aulasSemDisciplina(blocos: Bloco[], disciplinas: Disciplina[]): { titulo: string; turmas: string[] }[] {
  const out = new Map<string, { titulo: string; turmas: string[] }>();
  for (const b of blocos) {
    if (!ehAula(b) || disciplinaDoBloco(b, disciplinas, blocos)) continue;
    out.set(b.titulo + '|' + b.turmas.join(','), { titulo: b.titulo, turmas: b.turmas });
  }
  return [...out.values()];
}

/** Disciplina nova a partir do horário (sem módulos; acerta-se depois em Disciplinas). */
export function disciplinaDoHorario(a: { titulo: string; turmas: string[] }, n: number): Disciplina {
  const ano = Math.min(12, Math.max(5, Number(a.turmas[0]?.match(/\d+/)?.[0] ?? 10))) as Ano;
  const ensino: Ensino = ano <= 9 ? 'basico' : 'profissional';
  return {
    id: uid(),
    turma: nomeTurmas(a.turmas),
    nome: a.titulo,
    ano,
    ensino,
    componente: COMPONENTES.find((c) => c.ensino === ensino)!.id,
    cor: CORES[n % CORES.length],
    tempos: [0, 0, 0, 0, 0, 0, 0],
    diasSemAula: [],
    modulos: [],
  };
}

/** Guarda o horário e passa os tempos por dia para as disciplinas que lá estão. */
export function aplicarHorario(e: Estado, blocos: Bloco[], origem?: string, hoje?: string, criar: { titulo: string; turmas: string[] }[] = []): Estado {
  const novas = criar.map((a, i) => disciplinaDoHorario(a, e.disciplinas.length + i));
  const disciplinas = [...e.disciplinas, ...novas];
  const tempos = temposDoHorario(blocos, disciplinas, e.calendario.minutosPorTempo);
  return {
    ...e,
    horario: { blocos, origem, importado: hoje },
    disciplinas: disciplinas.map((d) => (tempos.has(d.id) ? { ...d, tempos: tempos.get(d.id)! } : d)),
  };
}

/** Grava blocos mudados à mão, mantendo a origem do horário, e acerta os tempos. */
export function gravarBlocos(e: Estado, blocos: Bloco[]): Estado {
  return aplicarHorario(e, blocos, e.horario?.origem, e.horario?.importado);
}

/** Hora (HH:MM) somada de minutos. */
export function somarMinutos(hhmm: string, n: number): string {
  const t = Math.min(23 * 60 + 55, minutos(hhmm) + n);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

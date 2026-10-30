import { uid, weekday } from './dates';
import { CORES } from './presets';
import { COMPONENTES, type Ano, type Atividade, type Aula, type Bloco, type Disciplina, type Ensino, type Estado } from './types';

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
  // Uma palavra só fica como está, sem pontos ("H.C.A." → "HCA").
  if (palavras.length === 1) return palavras[0].replace(/\./g, '').toUpperCase();
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
  if (a === b || sigla(nomeDisciplina) === sigla(titulo)) return true;
  // Abreviatura: "Hist." para "História".
  const [curto, longo] = [a, b].map((x) => x.replace(/\./g, '')).sort((x, y) => x.length - y.length);
  return curto.length >= 3 && !curto.includes(' ') && longo.split(' ')[0].startsWith(curto);
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
    t[b.dia] += b.tempos ?? Math.max(1, Math.round((minutos(b.fim) - minutos(b.inicio)) / minutosPorTempo));
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

/** Blocos que se sobrepõem no mesmo dia ficam lado a lado: faixa e número de faixas de cada um. */
export function faixas(blocos: Bloco[]): Map<string, { faixa: number; n: number }> {
  const out = new Map<string, { faixa: number; n: number }>();
  for (let dia = 0; dia < 7; dia++) {
    const lista = blocos.filter((b) => b.dia === dia).sort((a, b) => a.inicio.localeCompare(b.inicio));
    let grupo: Bloco[] = [];
    let fimGrupo = -1;
    let fins: number[] = [];
    const fechar = () => {
      const n = Math.max(1, fins.length);
      for (const b of grupo) out.set(b.id, { faixa: out.get(b.id)!.faixa, n });
      grupo = [];
      fins = [];
    };
    for (const b of lista) {
      if (minutos(b.inicio) >= fimGrupo) fechar();
      let f = fins.findIndex((fim) => fim <= minutos(b.inicio));
      if (f < 0) f = fins.push(0) - 1;
      fins[f] = minutos(b.fim);
      out.set(b.id, { faixa: f, n: 1 });
      grupo.push(b);
      fimGrupo = Math.max(fimGrupo, minutos(b.fim));
    }
    fechar();
  }
  return out;
}

/** Hora (HH:MM) somada de minutos. */
export function somarMinutos(hhmm: string, n: number): string {
  const t = Math.min(23 * 60 + 55, minutos(hhmm) + n);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

// ---- Horário construído em Disciplinas ----
// Cada aula tem dia, início e tempos seguidos. Na grelha, cada tempo é um bloco
// com a duração real da aula (ex.: 50 min); entre tempos seguidos há um
// intervalo que não se mostra (ex.: tempo de 60 min = 50 de aula + 10).

export const INTERVALO = 10;

/** Fim da aula: o último tempo acaba "duração" minutos depois de começar. */
export function fimDaAula(a: Pick<Aula, 'inicio' | 'tempos'>, duracao: number): string {
  return somarMinutos(a.inicio, a.tempos * duracao + (a.tempos - 1) * INTERVALO);
}

function hhmmDe(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Blocos antigos (importados) desta disciplina, juntos em aulas de tempos seguidos. */
function aulasDosBlocos(blocos: Bloco[], duracao: number): Aula[] {
  const ord = [...blocos].sort((a, b) => a.dia - b.dia || a.inicio.localeCompare(b.inicio));
  const out: Aula[] = [];
  for (const b of ord) {
    const n = b.tempos ?? Math.max(1, Math.round((minutos(b.fim) - minutos(b.inicio)) / duracao));
    const ult = out[out.length - 1];
    // Seguido da aula anterior (só o intervalo curto pelo meio): junta.
    if (ult && ult.dia === b.dia && ult.sala === b.sala && minutos(b.inicio) === minutos(fimDaAula(ult, duracao)) + INTERVALO && n * duracao + (n - 1) * INTERVALO === minutos(b.fim) - minutos(b.inicio)) {
      ult.tempos += n;
      continue;
    }
    // Um bloco de vários tempos com intervalos irregulares fica como está, numa aula só.
    out.push({ id: b.id, dia: b.dia, inicio: b.inicio, tempos: n, sala: b.sala });
  }
  return out;
}

/** Aulas da disciplina: as escritas em Disciplinas ou, em dados antigos, as do horário importado. */
export function aulasDe(d: Disciplina, e: Pick<Estado, 'horario' | 'disciplinas' | 'calendario'>): Aula[] {
  if (d.aulas) return d.aulas;
  const blocos = e.horario?.blocos ?? [];
  return aulasDosBlocos(blocos.filter((b) => disciplinaDoBloco(b, e.disciplinas, blocos)?.id === d.id), e.calendario.minutosPorTempo);
}

/** Outras atividades: as escritas em Disciplinas ou, em dados antigos, os blocos importados sem disciplina. */
export function atividadesDe(e: Pick<Estado, 'horario' | 'disciplinas' | 'atividades'>): Atividade[] {
  if (e.atividades) return e.atividades;
  const blocos = e.horario?.blocos ?? [];
  return blocos
    .filter((b) => !disciplinaDoBloco(b, e.disciplinas, blocos))
    .map((b) => ({ id: b.id, nome: b.turmas.length ? `${b.titulo} · ${nomeTurmas(b.turmas)}` : b.titulo, dia: b.dia, inicio: b.inicio, fim: b.fim, sala: b.sala }));
}

/** Tempos por dia da semana que saem das aulas (ou undefined se a disciplina não tem aulas com hora). */
export function temposDasAulas(aulas: Aula[]): number[] | undefined {
  if (!aulas.length) return undefined;
  const t = [0, 0, 0, 0, 0, 0, 0];
  for (const a of aulas) t[a.dia] += a.tempos;
  return t;
}

/** Grelha da semana: cada tempo de cada aula é um bloco; as atividades vão como estão. */
export function blocosDoEstado(e: Pick<Estado, 'horario' | 'disciplinas' | 'calendario' | 'atividades'>): Bloco[] {
  const dur = e.calendario.minutosPorTempo;
  const out: Bloco[] = [];
  for (const d of e.disciplinas) {
    for (const a of aulasDe(d, e)) {
      for (let k = 0; k < a.tempos; k++) {
        const ini = minutos(a.inicio) + k * (dur + INTERVALO);
        out.push({ id: `${a.id}-${k}`, dia: a.dia, inicio: hhmmDe(ini), fim: hhmmDe(ini + dur), titulo: d.nome || d.turma, turmas: [d.turma], sala: a.sala, disciplinaId: d.id, tempos: 1 });
      }
    }
  }
  for (const t of atividadesDe(e)) out.push({ id: t.id, dia: t.dia, inicio: t.inicio, fim: t.fim, titulo: t.nome, turmas: [], sala: t.sala });
  return out.sort((a, b) => a.dia - b.dia || a.inicio.localeCompare(b.inicio));
}

/**
 * Importação (.ics ou PDF): cada disciplina fica com as suas aulas e o resto
 * vai para as outras atividades. Cria as disciplinas pedidas.
 */
export function importarHorario(e: Estado, blocos: Bloco[], criar: { titulo: string; turmas: string[] }[] = []): Estado {
  const novas = criar.map((a, i) => disciplinaDoHorario(a, e.disciplinas.length + i));
  const disciplinas = [...e.disciplinas, ...novas];
  const dur = e.calendario.minutosPorTempo;
  const ligados = new Map(blocos.map((b) => [b.id, disciplinaDoBloco(b, disciplinas, blocos)]));
  return {
    ...e,
    horario: undefined,
    disciplinas: disciplinas.map((d) => {
      const meus = blocos.filter((b) => ligados.get(b.id)?.id === d.id);
      if (!meus.length) return d;
      const aulas = aulasDosBlocos(meus, dur);
      return { ...d, aulas, tempos: temposDasAulas(aulas)! };
    }),
    atividades: blocos
      .filter((b) => !ligados.get(b.id))
      .map((b) => ({ id: b.id, nome: b.turmas.length ? `${b.titulo} · ${nomeTurmas(b.turmas)}` : b.titulo, dia: b.dia, inicio: b.inicio, fim: b.fim, sala: b.sala })),
  };
}

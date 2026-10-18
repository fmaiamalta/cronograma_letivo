import { isValidISO, weekday } from './dates';
import { juntar, linhasDeItens, type ItemPDF } from './pdfLayout';
import type { Ano, ISODate } from './types';

export interface SugestaoCalendario {
  inicio?: ISODate;
  /** Inícios diferentes por nível de ensino ("21 Setembro - Secundário"). */
  inicios: { data: ISODate; nota: string }[];
  fimPorAno: Partial<Record<Ano, ISODate>>;
  interrupcoes: { nome: string; inicio: ISODate; fim: ISODate }[];
  feriados: { nome: string; data: ISODate }[];
}

const MESES: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const NOMES_INTERRUPCAO: [RegExp, string][] = [
  [/natal/i, 'Natal'],
  [/carnaval/i, 'Carnaval'],
  [/p[aá]scoa/i, 'Páscoa'],
  [/interrup/i, 'Interrupção'],
];

// Comparados com o texto já sem acentos e em minúsculas.
const NOMES_FERIADO: [RegExp, string][] = [
  [/implantacao|\bi\.?\s*republica/, 'Implantação da República'],
  [/todos os santos|\bt\.?\s*santos/, 'Todos os Santos'],
  [/restauracao|independencia/, 'Restauração da Independência'],
  [/imaculada|\bi\.?\s*conceicao/, 'Imaculada Conceição'],
  [/ano novo/, 'Ano Novo'],
  [/sexta.feira santa/, 'Sexta-feira Santa'],
  [/25 de abril|liberdade/, 'Dia da Liberdade'],
  [/trabalhador/, 'Dia do Trabalhador'],
  [/corpo de deus|\bc\.?\s*deus/, 'Corpo de Deus'],
  [/dia de portugal|dia portugal/, 'Dia de Portugal'],
  [/(santo|st[oº]?\.?)\s*antonio/, 'Santo António (feriado municipal)'],
  [/s(ao|\.)\s*joao/, 'São João (feriado municipal)'],
  [/s(ao|\.)\s*pedro/, 'São Pedro (feriado municipal)'],
  [/municipal/, 'Feriado municipal'],
];
const FERIADO_GENERICO: [RegExp, string] = [/feriado/, 'Feriado'];

// Dentro da grelha, só estes rótulos de um dia contam como dia sem aulas.
const DIAS_SEM_AULAS_GRELHA: [RegExp, string][] = [...NOMES_FERIADO, [/^natal$/, 'Natal'], [/^carnaval$/, 'Carnaval']];

function semAcentos(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Ano civil de um mês dentro do ano letivo que começa em setembro de anoInicial. */
function anoDoMes(mes: number, anoInicial: number): number {
  return mes >= 8 ? anoInicial : anoInicial + 1;
}

function montar(d: number, m: number, a: number | undefined, anoInicial: number): ISODate | undefined {
  let ano = a ?? anoDoMes(m, anoInicial);
  if (ano < 100) ano += 2000;
  const iso = `${ano}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return isValidISO(iso) ? iso : undefined;
}

// "16/12", "16/12/2026", "16 de dezembro", "16 Dezembro", "4Junho", "16 de dezembro de 2026"
const MES_TXT = String.raw`(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)`;
const DATA = String.raw`(?<!\d)(\d{1,2})\s*(?:[/.-]\s*(\d{1,2})(?:\s*[/.-]\s*(\d{2,4}))?|(?:de\s+)?${MES_TXT}(?:\s+(?:de\s+)?(\d{4}))?)`;
const SEP = String.raw`\s*(?:a|até|ao|–|—|-)\s*`;
// "08 a 10 Fevereiro", "8 a 10 de fevereiro"
const MESMO_MES = String.raw`(?<!\d)(\d{1,2})${SEP}(\d{1,2})\s*(?:de\s+)?${MES_TXT}(?:\s+(?:de\s+)?(\d{4}))?`;

function lerData(g: (string | undefined)[], off: number, anoInicial: number): ISODate | undefined {
  const d = Number(g[off]);
  if (g[off + 1]) return montar(d, Number(g[off + 1]), g[off + 2] ? Number(g[off + 2]) : undefined, anoInicial);
  const mes = MESES[semAcentos(g[off + 3] ?? '')];
  if (!mes) return undefined;
  return montar(d, mes, g[off + 4] ? Number(g[off + 4]) : undefined, anoInicial);
}

/** Anos (10.º a 12.º) citados logo a seguir a uma data: "4 Junho/9º, 11º, 12º". */
function anosCitados(depois: string): Ano[] {
  // Só até à data seguinte.
  const corte = depois.search(new RegExp(String.raw`\d{1,2}\s*(?:[/.-]\s*\d|(?:de\s+)?${MES_TXT})`, 'i'));
  const trecho = corte >= 0 ? depois.slice(0, corte) : depois;
  const anos = [...trecho.matchAll(/(\d{1,2})\s*[º°.]/g)].map((m) => Number(m[1]));
  return anos.filter((a): a is Ano => a >= 5 && a <= 12);
}

function ultimoNome(texto: string, nomes: [RegExp, string][]): string | undefined {
  let melhor: { pos: number; nome: string } | undefined;
  for (const [re, nome] of nomes) {
    const g = new RegExp(re.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = g.exec(texto))) {
      if (!melhor || m.index > melhor.pos) melhor = { pos: m.index, nome };
    }
  }
  return melhor?.nome;
}

function nomeFeriado(texto: string): string | undefined {
  const t = semAcentos(texto);
  return ultimoNome(t, NOMES_FERIADO) ?? ultimoNome(t, [FERIADO_GENERICO]);
}

function juntarSugestoes(a: SugestaoCalendario, b: SugestaoCalendario): SugestaoCalendario {
  const out: SugestaoCalendario = {
    inicio: [a.inicio, b.inicio].filter(Boolean).sort()[0],
    inicios: [...a.inicios, ...b.inicios.filter((x) => !a.inicios.some((y) => y.data === x.data))],
    fimPorAno: { ...b.fimPorAno, ...a.fimPorAno },
    interrupcoes: [...a.interrupcoes],
    feriados: [...a.feriados],
  };
  for (const i of b.interrupcoes) if (!out.interrupcoes.some((x) => x.inicio === i.inicio)) out.interrupcoes.push(i);
  for (const f of b.feriados) if (!out.feriados.some((x) => x.data === f.data)) out.feriados.push(f);
  out.interrupcoes.sort((x, y) => x.inicio.localeCompare(y.inicio));
  out.feriados.sort((x, y) => x.data.localeCompare(y.data));
  out.inicios.sort((x, y) => x.data.localeCompare(y.data));
  return out;
}

/**
 * Procura datas num texto de calendário escolar. Com os pedaços de um PDF,
 * lê também a grelha mensal (dias em linhas, meses em colunas). O resultado é
 * só uma sugestão: a pessoa confirma tudo antes de gravar.
 */
export function lerCalendario(texto: string, anoInicial: number, itens?: ItemPDF[]): SugestaoCalendario {
  const doTexto = lerCalendarioTexto(texto, anoInicial);
  return itens?.length ? juntarSugestoes(doTexto, lerGrelha(itens, anoInicial)) : doTexto;
}

function lerCalendarioTexto(texto: string, anoInicial: number): SugestaoCalendario {
  const out: SugestaoCalendario = { inicios: [], fimPorAno: {}, interrupcoes: [], feriados: [] };
  const linhas = texto.replace(/ /g, ' ').split(/\r?\n/);

  const reMesmoMes = new RegExp(MESMO_MES, 'gi');
  const reIntervalo = new RegExp(DATA + SEP + DATA, 'gi');
  const reData = new RegExp(DATA, 'gi');

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const contexto = `${linhas[i - 1] ?? ''} ${linha}`;
    const usados: [number, number][] = [];
    const sobrepoe = (a: number, b: number) => usados.some(([x, y]) => a < y && b > x);

    const intervalo = (inicio: ISODate | undefined, fim: ISODate | undefined, idx: number, len: number) => {
      if (!inicio || !fim || fim < inicio || sobrepoe(idx, idx + len)) return;
      usados.push([idx, idx + len]);
      const antes = linha.slice(0, idx);
      const nome = ultimoNome(antes.trim() ? antes : contexto, NOMES_INTERRUPCAO);
      if (nome) {
        if (!out.interrupcoes.some((x) => x.inicio === inicio && x.fim === fim)) out.interrupcoes.push({ nome, inicio, fim });
        return;
      }
      if (/per[ií]odo|\d\s*\.?\s*º\s*p\b|semestre|ano letivo|atividades letivas|aulas/i.test(contexto)) {
        if (!out.inicio || inicio < out.inicio) out.inicio = inicio;
        // Só o 1.º período (o que começa entre agosto e outubro) marca o início das aulas.
        const mes = Number(inicio.slice(5, 7));
        if (mes >= 8 && mes <= 10 && !out.inicios.some((x) => x.data === inicio)) {
          const nota = linha.slice(idx + len).replace(/^[\s\-–—:,]+/, '').trim().slice(0, 60);
          out.inicios.push({ data: inicio, nota });
        }
        for (const ano of anosCitados(linha.slice(idx + len))) out.fimPorAno[ano] ??= fim;
      }
    };

    let m: RegExpExecArray | null;
    reMesmoMes.lastIndex = 0;
    while ((m = reMesmoMes.exec(linha))) {
      const mes = MESES[semAcentos(m[3])];
      const ano = m[4] ? Number(m[4]) : undefined;
      intervalo(montar(Number(m[1]), mes, ano, anoInicial), montar(Number(m[2]), mes, ano, anoInicial), m.index, m[0].length);
    }
    reIntervalo.lastIndex = 0;
    while ((m = reIntervalo.exec(linha))) {
      intervalo(lerData(m, 1, anoInicial), lerData(m, 6, anoInicial), m.index, m[0].length);
    }

    reData.lastIndex = 0;
    while ((m = reData.exec(linha))) {
      const idx = m.index;
      if (sobrepoe(idx, idx + m[0].length)) continue;
      const data = lerData(m, 1, anoInicial);
      if (!data) continue;
      const depois = linha.slice(idx + m[0].length);
      const antes = linha.slice(Math.max(0, idx - 60), idx);
      const anos = anosCitados(depois);
      if (anos.length && /fim|final|termo|t[eé]rmino|ano letivo|\bp\b/i.test(contexto)) {
        for (const ano of anos) out.fimPorAno[ano] ??= data;
        continue;
      }
      const nome = nomeFeriado(`${antes} ${depois.slice(0, 60)}`);
      if (nome && !out.feriados.some((f) => f.data === data)) out.feriados.push({ nome, data });
      else if (/in[ií]cio/i.test(antes) && (!out.inicio || data < out.inicio)) out.inicio = data;
    }
  }
  out.interrupcoes.sort((a, b) => a.inicio.localeCompare(b.inicio));
  out.feriados.sort((a, b) => a.data.localeCompare(b.data));
  out.inicios.sort((a, b) => a.data.localeCompare(b.data));
  return out;
}

const DIA_SEMANA_ROTULO: [RegExp, number][] = [
  [/^2/, 0], [/^3/, 1], [/^4/, 2], [/^5/, 3], [/^6/, 4], [/^s[aá]b/i, 5], [/^dom/i, 6],
];

/**
 * Calendário em grelha: uma linha de cabeçalho com os meses (SET OUT NOV...) e,
 * em cada coluna, o número do dia seguido de um rótulo ("5 I República").
 */
export function lerGrelha(itens: ItemPDF[], anoInicial: number): SugestaoCalendario {
  const out: SugestaoCalendario = { inicios: [], fimPorAno: {}, interrupcoes: [], feriados: [] };
  const linhas = linhasDeItens(itens);

  const cab = linhas.find((l) => l.filter((i) => MESES_CURTOS.includes(semAcentos(i.s.trim()).slice(0, 3)) && i.s.trim().length <= 9).length >= 6);
  if (!cab) return out;
  const colunas = cab
    .filter((i) => MESES_CURTOS.includes(semAcentos(i.s.trim()).slice(0, 3)))
    .map((i) => ({ x: i.x, mes: MESES_CURTOS.indexOf(semAcentos(i.s.trim()).slice(0, 3)) + 1 }));
  const larg = Math.min(...colunas.slice(1).map((c, k) => c.x - colunas[k].x));
  const margem = larg * 0.45;
  const coluna = (x: number) => [...colunas].reverse().find((c) => x >= c.x - margem);

  for (const linha of linhas) {
    if (linha[0].p !== cab[0].p || linha[0].y >= cab[0].y) continue;
    // Dia da semana da linha (coluna à esquerda dos meses), para validar as datas.
    const rotulo = juntar(linha.filter((i) => i.x < colunas[0].x - margem));
    const ds = DIA_SEMANA_ROTULO.find(([re]) => re.test(rotulo.trim()))?.[1];

    const porColuna = new Map<number, ItemPDF[]>();
    for (const it of linha) {
      const c = coluna(it.x);
      if (!c) continue;
      if (!porColuna.has(c.mes)) porColuna.set(c.mes, []);
      porColuna.get(c.mes)!.push(it);
    }
    for (const [mes, partes] of porColuna) {
      const celula = juntar(partes).match(/^(\d{1,2})\s*(.*)$/);
      if (!celula) continue;
      const data = montar(Number(celula[1]), mes, undefined, anoInicial);
      if (!data || (ds !== undefined && weekday(data) !== ds)) continue;
      const etiqueta = celula[2].trim();
      if (!etiqueta) continue;
      const t = semAcentos(etiqueta);
      const anos = [...etiqueta.matchAll(/(\d{1,2})\s*[º°]/g)].map((x) => Number(x[1])).filter((a): a is Ano => a >= 5 && a <= 12);
      if (anos.length && mes >= 5 && mes <= 7) {
        for (const a of anos) out.fimPorAno[a] ??= data;
        continue;
      }
      if (/^1\s*\.?\s*º?\s*p$/.test(t.replace(/\s+/g, ' '))) {
        out.inicio = data;
        continue;
      }
      const nome = ultimoNome(t, DIAS_SEM_AULAS_GRELHA);
      if (nome && !out.feriados.some((f) => f.data === data)) out.feriados.push({ nome, data });
    }
  }
  out.feriados.sort((a, b) => a.data.localeCompare(b.data));
  return out;
}

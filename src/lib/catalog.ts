import type { Componente, EntradaCatalogo } from './types';

/** 1 ponto de crédito = 100/9 h (2,25 pontos = 25 h; 4,5 pontos = 50 h). */
export function pontosParaHoras(pontos: number): number {
  return Math.round((pontos * 100) / 9);
}

/** "2640", "uc 2640" e "UC02640" dão todos "UC02640". */
export function normalizarCodigo(input: string): string {
  const s = input.trim().toUpperCase().replace(/\s+/g, '');
  const soNumero = s.match(/^(?:UC)?(\d{1,5})$/);
  if (soNumero) return 'UC' + soNumero[1].padStart(5, '0');
  return s;
}

export function procurarCodigo(catalogo: EntradaCatalogo[], input: string): EntradaCatalogo | undefined {
  if (!input.trim()) return undefined;
  const cod = normalizarCodigo(input);
  return catalogo.find((e) => e.codigo === cod);
}

function semAcentos(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function pesquisarCatalogo(catalogo: EntradaCatalogo[], termo: string, max = 30): EntradaCatalogo[] {
  const t = semAcentos(termo.trim());
  if (!t) return catalogo.slice(0, max);
  const cod = normalizarCodigo(termo);
  return catalogo
    .filter((e) => e.codigo === cod || semAcentos(e.codigo).includes(t) || semAcentos(e.nome).includes(t))
    .slice(0, max);
}

/** UC do referencial ou módulo criado à mão: o que pode entrar como módulo de uma disciplina. */
export function ehUC(e: EntradaCatalogo): boolean {
  return e.codigo.startsWith('UC') || !!e.modulo;
}

/** Disciplina do referencial (Português, Matemática, ...). */
export function ehDisciplina(e: EntradaCatalogo): boolean {
  return !ehUC(e);
}

/** Código mostrado ao utilizador: os módulos criados à mão não têm código. */
export function codigoVisivel(e: EntradaCatalogo): string {
  return e.modulo ? '' : e.codigo;
}

/**
 * Entrada de catálogo para um módulo escrito à mão no horário, ou null se não
 * há nada a gravar: módulo incompleto, ou já existe igual (mesmo código ou, sem
 * código, mesmo nome). Uma entrada criada à mão é atualizada (ex.: duração).
 */
export function entradaParaModulo(
  catalogo: EntradaCatalogo[],
  m: { codigo?: string; nome: string; quantidade: number; unidade: 'h' | 't' },
  componente: Componente,
  minutosPorTempo: number,
): EntradaCatalogo | null {
  const nome = m.nome.trim();
  if (!nome || !(m.quantidade > 0)) return null;
  const horas = m.unidade === 'h' ? m.quantidade : Math.round(((m.quantidade * minutosPorTempo) / 60) * 100) / 100;
  if (m.codigo?.trim()) {
    const codigo = normalizarCodigo(m.codigo);
    const nova: EntradaCatalogo = { codigo, nome, horas, componente, manual: true };
    const atual = catalogo.find((e) => e.codigo === codigo);
    return atual && (!atual.manual || igual(atual, nova)) ? null : nova;
  }
  const chave = semAcentos(nome);
  const nova: EntradaCatalogo = { codigo: `MOD:${chave}`, nome, horas, componente, modulo: true, manual: true };
  const atual = catalogo.find((e) => semAcentos(e.nome) === chave);
  return atual && (!atual.manual || igual(atual, nova)) ? null : { ...nova, codigo: atual?.codigo ?? nova.codigo };
}

function igual(a: EntradaCatalogo, b: EntradaCatalogo): boolean {
  return a.nome === b.nome && a.horas === b.horas && a.componente === b.componente;
}

/** Junta entradas novas ao catálogo; as novas substituem as que têm o mesmo código. */
export function juntarCatalogo(atual: EntradaCatalogo[], novas: EntradaCatalogo[]): EntradaCatalogo[] {
  const mapa = new Map(atual.map((e) => [e.codigo, e]));
  for (const n of novas) mapa.set(n.codigo, { ...mapa.get(n.codigo), ...n });
  return [...mapa.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
}

function componenteDeTexto(s: string): Componente | undefined {
  const t = semAcentos(s);
  if (t.startsWith('socio')) return 'sociocultural';
  if (t.startsWith('cien')) return 'cientifica';
  if (t.startsWith('tec')) return 'tecnologica';
  if (t.includes('contexto') || t === 'fct') return 'fct';
  return undefined;
}

/**
 * CSV ou texto com uma entrada por linha: código; nome; horas[; componente].
 * Aceita ; , ou tabulação como separador e ignora o cabeçalho.
 */
export function lerCatalogoCSV(texto: string): EntradaCatalogo[] {
  const out: EntradaCatalogo[] = [];
  for (const linha of texto.split(/\r?\n/)) {
    if (!linha.trim()) continue;
    const sep = linha.includes(';') ? ';' : linha.includes('\t') ? '\t' : ',';
    const cols = linha.split(sep).map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 3) continue;
    const horas = Number(cols[2].replace(',', '.').replace(/h$/i, ''));
    if (!cols[0] || !cols[1] || !Number.isFinite(horas) || horas <= 0) continue;
    out.push({
      codigo: normalizarCodigo(cols[0]),
      nome: cols[1],
      horas,
      componente: componenteDeTexto(cols[3] ?? '') ?? 'tecnologica',
    });
  }
  return out;
}

/**
 * Lê o texto de um referencial do Catálogo Nacional de Qualificações (PDF ou
 * DOCX convertido em texto). Procura a tabela das UC (código, n.º, nome,
 * pontos de crédito) e as disciplinas DACP com horas.
 */
export function lerReferencial(texto: string): EntradaCatalogo[] {
  const linhas = texto.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const qualificacao = texto.match(/\d{3}[A-Z]{2}\d{3}\s*-\s*([^\n|]+?)(?:\n|$)/)?.[1]?.trim();

  // Tabela-resumo: tudo antes do capítulo com o desenvolvimento de cada UC.
  const fimResumo = linhas.findIndex((l) => /Desenvolvimento das Unidades de Compet/i.test(l));
  const resumo = (fimResumo > 0 ? linhas.slice(0, fimResumo) : linhas).join(' ');

  const out = new Map<string, EntradaCatalogo>();
  let opcional = false;
  const marcaOpcionais = resumo.search(/\bOPCIONAIS\b/);
  const re = /(UC\d{5})\s+(\d{1,2})\s+(.+?)\s+(\d{1,2},\d{1,2}|\d{1,2})(?=\s|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(resumo))) {
    opcional = marcaOpcionais >= 0 && m.index > marcaOpcionais;
    const pontos = Number(m[4].replace(',', '.'));
    out.set(m[1], {
      codigo: m[1],
      nome: m[3].trim(),
      pontos,
      horas: pontosParaHoras(pontos),
      componente: 'tecnologica',
      opcional,
      qualificacao,
    });
  }

  // No desenvolvimento, cada UC aparece como "UC02629" seguido do nome completo
  // numa linha própria. Serve para completar nomes partidos na tabela.
  for (let i = 0; i < linhas.length - 1; i++) {
    const cod = linhas[i].match(/^(UC\d{5})(?:\s+(.+))?$/);
    if (!cod || !out.has(cod[1])) continue;
    const nome = cod[2] ?? linhas[i + 1];
    const atual = out.get(cod[1])!;
    if (nome.length > atual.nome.length && semAcentos(nome).startsWith(semAcentos(atual.nome))) {
      out.set(cod[1], { ...atual, nome });
    }
  }

  const reDisc = /(DACP\w{7})\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][^\d]+?)\s+(\d{2,3})(?=\s|$)/g;
  while ((m = reDisc.exec(resumo))) {
    const nome = m[2].trim();
    // Células de tabela coladas umas às outras dão "nomes" absurdos: ignora-os.
    if (nome.length > 70 || /C[óo]digo|Disciplina|Horas/.test(nome)) continue;
    const letra = m[1][8];
    out.set(m[1], {
      codigo: m[1],
      nome,
      horas: Number(m[3]),
      componente: letra === 'C' ? 'cientifica' : 'sociocultural',
      qualificacao,
    });
  }
  return [...out.values()];
}

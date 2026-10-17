/** Um pedaço de texto de um PDF, com a posição que o pdf.js devolve. */
export interface ItemPDF {
  x: number;
  y: number;
  w: number;
  s: string;
  p: number; // página
}

const MESMA_LINHA = 2.5;

/** Agrupa os pedaços por página e por linha (mesmo y), da esquerda para a direita. */
export function linhasDeItens(itens: ItemPDF[]): ItemPDF[][] {
  const ord = [...itens].filter((i) => i.s.trim()).sort((a, b) => a.p - b.p || b.y - a.y || a.x - b.x);
  const linhas: ItemPDF[][] = [];
  for (const it of ord) {
    const ultima = linhas[linhas.length - 1];
    if (ultima && ultima[0].p === it.p && Math.abs(ultima[0].y - it.y) <= MESMA_LINHA) ultima.push(it);
    else linhas.push([it]);
  }
  for (const l of linhas) l.sort((a, b) => a.x - b.x);
  return linhas;
}

/**
 * Junta pedaços colados ("N" + "ATAL" dá "NATAL"; "1" + "6" dá "16") e põe
 * espaço quando há um intervalo pequeno.
 */
export function juntar(itens: ItemPDF[]): string {
  let out = '';
  let fim = -Infinity;
  for (const it of itens) {
    const gap = it.x - fim;
    if (out && gap > 0.6 && !out.endsWith(' ') && !it.s.startsWith(' ')) out += ' ';
    out += it.s;
    fim = it.x + it.w;
  }
  return out.replace(/\s+/g, ' ').trim();
}

interface Bloco {
  x: number;
  y: number;
  p: number;
  itens: ItemPDF[];
}

/**
 * Converte os pedaços num texto com uma linha por bloco. Um bloco é um conjunto
 * de pedaços seguidos na mesma linha, sem grandes espaços entre eles (as
 * colunas de uma tabela ficam em blocos diferentes). Um bloco que acaba em
 * "de" ou "a" continua no bloco logo abaixo, na mesma coluna.
 */
export function textoDeItens(itens: ItemPDF[]): string {
  const blocos: Bloco[] = [];
  for (const linha of linhasDeItens(itens)) {
    let atual: Bloco | null = null;
    let fim = -Infinity;
    for (const it of linha) {
      if (!atual || it.x - fim > 16) {
        atual = { x: it.x, y: it.y, p: it.p, itens: [] };
        blocos.push(atual);
      }
      atual.itens.push(it);
      fim = it.x + it.w;
    }
  }
  const textos = blocos.map((b) => juntar(b.itens));
  const usado = new Set<number>();
  const out: string[] = [];
  for (let i = 0; i < blocos.length; i++) {
    if (usado.has(i)) continue;
    let t = textos[i];
    let b = blocos[i];
    while (/\b(de|a|até|e)$/i.test(t)) {
      const j = blocos.findIndex(
        (c, k) => !usado.has(k) && k > i && c.p === b.p && b.y - c.y > 0 && b.y - c.y < 22 && Math.abs(c.x - b.x) < 10,
      );
      if (j < 0) break;
      usado.add(j);
      t += ' ' + textos[j];
      b = blocos[j];
    }
    out.push(t);
  }
  return out.join('\n');
}

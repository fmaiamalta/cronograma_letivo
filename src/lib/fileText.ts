// Extrai texto de PDF, DOCX, imagem (OCR) ou ficheiro de texto. As bibliotecas
// pesadas só são carregadas quando são precisas.

import type { ItemPDF } from './pdfLayout';
import { textoDeItens } from './pdfLayout';

export interface ConteudoFicheiro {
  texto: string;
  /** Só para PDF: os pedaços de texto com posição, para ler tabelas e grelhas. */
  itens?: ItemPDF[];
}

export async function lerFicheiro(file: File, progresso?: (msg: string) => void): Promise<ConteudoFicheiro> {
  const nome = file.name.toLowerCase();
  if (file.type === 'application/pdf' || nome.endsWith('.pdf')) {
    const itens = await itensDePDF(file);
    return { texto: textoDeItens(itens), itens };
  }
  if (nome.endsWith('.docx')) return { texto: await textoDeDOCX(file) };
  if (file.type.startsWith('image/')) return { texto: await textoDeImagem(file, progresso) };
  return { texto: await file.text() };
}

async function itensDePDF(file: File): Promise<ItemPDF[]> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const itens: ItemPDF[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      itens.push({ x: item.transform[4], y: item.transform[5], w: item.width, s: item.str, p });
    }
  }
  return itens;
}

async function textoDeDOCX(file: File): Promise<string> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) return '';
  const paragrafos = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? [];
  return paragrafos
    .map((p) => (p.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, '')).join(''))
    .map((t) => t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'"))
    .filter((t) => t.trim())
    .join('\n');
}

async function textoDeImagem(file: File, progresso?: (msg: string) => void): Promise<string> {
  progresso?.('A ler a imagem (pode demorar 20 a 40 segundos)...');
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('por');
  try {
    const { data } = await worker.recognize(file);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

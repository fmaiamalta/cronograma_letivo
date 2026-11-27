import { useEffect, useState } from 'react';
import { guardarPdf, type PdfPronto } from '../lib/exportarPdf';

/**
 * Mostra o PDF dentro da app, página a página (imagens feitas com o pdf.js).
 * Na app instalada não se pode abrir o PDF noutro separador nem no visor do
 * browser; assim vê-se, imprime-se e guarda-se sempre da mesma maneira.
 */
export function VisorPdf({ pdf, onFechar }: { pdf: PdfPronto; onFechar: () => void }) {
  const [paginas, setPaginas] = useState<string[]>([]);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        const dados = new Uint8Array(await (await fetch(pdf.url)).arrayBuffer());
        const doc = await pdfjs.getDocument({ data: dados }).promise;
        const out: string[] = [];
        for (let p = 1; p <= doc.numPages; p++) {
          const pagina = await doc.getPage(p);
          // Nítido no ecrã e na impressão: cerca de 2000 px de largura.
          const escala = 2000 / pagina.getViewport({ scale: 1 }).width;
          const vp = pagina.getViewport({ scale: escala });
          const canvas = document.createElement('canvas');
          canvas.width = vp.width;
          canvas.height = vp.height;
          await pagina.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
          out.push(canvas.toDataURL('image/png'));
        }
        if (!cancelado) setPaginas(out);
      } catch (e) {
        if (!cancelado) setErro(`Não foi possível mostrar o PDF: ${(e as Error).message}`);
      }
    })();
    return () => { cancelado = true; };
  }, [pdf.url]);

  // Ao imprimir, só as páginas do PDF.
  useEffect(() => {
    document.documentElement.classList.add('a-ver-pdf');
    return () => document.documentElement.classList.remove('a-ver-pdf');
  }, []);

  return (
    <div className="pdf-visor" role="dialog" aria-modal="true" aria-label={pdf.nome}>
      <div className="pdf-visor-barra">
        <strong>{pdf.nome}</strong>
        <div className="row">
          <button className="btn" onClick={() => window.print()} disabled={!paginas.length}>Imprimir</button>
          <button className="btn" onClick={() => guardarPdf(pdf)}>Guardar</button>
          <button className="btn primary" onClick={onFechar}>Fechar</button>
        </div>
      </div>
      <div className="pdf-paginas">
        {erro && <p className="warn">{erro}</p>}
        {!erro && !paginas.length && <p className="muted">A preparar...</p>}
        {paginas.map((src, i) => <img key={i} src={src} alt={`Página ${i + 1}`} />)}
      </div>
    </div>
  );
}

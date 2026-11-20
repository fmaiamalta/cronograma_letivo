import type { jsPDF } from 'jspdf';
import { fimDoMes, limitesDoCronograma, quebrasDe, trocos } from '../components/Gantt';
import { addDays, diffDays, fmtShort, MESES, todayISO } from './dates';
import { dadoDoTotal, quantidade, type PlanoDisciplina } from './engine';
import { blocosDoEstado, ehAula, faixas, minutos, nomeTurmas, semAulaNoBloco, sigla } from './horario';
import { ehGeral, ENSINOS, ensinoDe, type Estado, type ISODate } from './types';

// PDF feito à mão com o jsPDF (texto e formas, não uma imagem do ecrã): fica
// nítido, leve e igual no computador e no telemóvel. A4 deitado.

type RGB = [number, number, number];

const L = 297;
const A = 210;
const M = 10; // margem

function rgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mistura com branco (0 = cor, 1 = branco). */
function claro(c: RGB, f: number): RGB {
  return c.map((v) => Math.round(v + (255 - v) * f)) as RGB;
}

const CINZA: RGB = [110, 110, 110];
const LINHA: RGB = [225, 225, 225];
const FUNDO: RGB = [238, 238, 238];
const HOJE: RGB = [214, 69, 54];
const AVISO: RGB = [214, 120, 60];

async function novoDoc(): Promise<jsPDF> {
  const { jsPDF } = await import('jspdf');
  return new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
}

/** Corta o texto para caber na largura (com "..."). */
function caber(doc: jsPDF, texto: string, largura: number): string {
  if (doc.getTextWidth(texto) <= largura) return texto;
  let t = texto;
  while (t.length > 1 && doc.getTextWidth(t + '...') > largura) t = t.slice(0, -1);
  return t.trimEnd() + '...';
}

function rodape(doc: jsPDF) {
  const n = doc.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...CINZA);
    doc.text(`Exportado a ${todayISO().split('-').reverse().join('/')} · Desenvolvido por Spiga`, M, A - 5);
    if (n > 1) doc.text(`${p}/${n}`, L - M, A - 5, { align: 'right' });
  }
}

/** Entrega o PDF: no telemóvel abre a folha de partilha (guardar, enviar); no computador descarrega. */
export async function entregar(doc: jsPDF, nome: string) {
  // Sem acentos nem símbolos no nome: alguns browsers trocam-no por "download".
  nome = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/º/g, '').replace(/[^\w .-]+/g, '-').replace(/\s+/g, ' ').trim();
  const blob = doc.output('blob');
  const file = new File([blob], nome, { type: 'application/pdf' });
  const toque = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  if (toque && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: nome });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Cronograma das disciplinas escolhidas, com interrupções, feriados, dias sem aulas e o dia de hoje. */
export async function pdfCronograma(e: Estado, planos: PlanoDisciplina[], hoje: ISODate, subtitulo: string, docente?: string): Promise<jsPDF> {
  const doc = await novoDoc();
  const cal = e.calendario;
  const ausencias = e.ausencias ?? [];
  // Só os meses com aulas das disciplinas escolhidas (e as suas tarefas).
  const { inicio, fim } = limitesDoCronograma(planos, cal);
  /** Parte de um período que cai dentro do cronograma (ou null). */
  const dentro = (a: ISODate, b: ISODate): [ISODate, ISODate] | null => (b < inicio || a > fim ? null : [a < inicio ? inicio : a, b > fim ? fim : b]);
  const rot = 72; // coluna dos nomes
  const x0 = M + rot;
  const largura = L - M - x0;
  const dias = diffDays(inicio, fim) + 1;
  const pxDia = largura / dias;
  const x = (iso: ISODate) => x0 + diffDays(inicio, iso) * pxDia;
  const topoGrelha = 30;
  const fundo = A - 12;

  const meses: ISODate[] = [];
  for (let d = inicio; d <= fim; d = addDays(fimDoMes(d), 1)) meses.push(d);

  const cabecalho = () => {
    doc.setTextColor(20, 20, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`Cronograma ${cal.anoLetivo}`, M, 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...CINZA);
    doc.text([docente, cal.escola, subtitulo, `Dadas até ${hoje.split('-').reverse().join('/')}`].filter(Boolean).join(' · '), M, 19.5);
    // Meses
    doc.setFontSize(7.5);
    for (const m of meses) {
      const w = (diffDays(m, fimDoMes(m)) + 1) * pxDia;
      doc.setTextColor(...CINZA);
      doc.text(MESES[Number(m.slice(5, 7)) - 1], x(m) + w / 2, topoGrelha - 2, { align: 'center' });
    }
    // Interrupções: datas por cima
    doc.setFontSize(6);
    for (const i of cal.interrupcoes) {
      const p = dentro(i.inicio, i.fim);
      if (!p) continue;
      const w = (diffDays(p[0], p[1]) + 1) * pxDia;
      const t = `${fmtShort(i.inicio)}–${fmtShort(i.fim)}`;
      const tw = doc.getTextWidth(t);
      doc.text(t, Math.min(Math.max(x(p[0]) + w / 2 - tw / 2, x0), L - M - tw), topoGrelha - 6.5);
    }
  };

  // Fundo da grelha numa página, da linha de cima até "ate".
  const grelha = (ate: number) => {
    for (const i of cal.interrupcoes) {
      const p = dentro(i.inicio, i.fim);
      if (!p) continue;
      doc.setFillColor(...FUNDO);
      doc.rect(x(p[0]), topoGrelha, (diffDays(p[0], p[1]) + 1) * pxDia, ate - topoGrelha, 'F');
    }
    for (const a of ausencias.filter((a) => !a.disciplinaId && !a.conta)) {
      const p = dentro(a.inicio, a.fim);
      if (!p) continue;
      doc.setFillColor(...claro(AVISO, 0.75));
      doc.rect(x(p[0]), topoGrelha, Math.max(0.4, (diffDays(p[0], p[1]) + 1) * pxDia), ate - topoGrelha, 'F');
    }
    doc.setDrawColor(...LINHA);
    doc.setLineWidth(0.2);
    for (const m of meses) doc.line(x(m), topoGrelha - 1, x(m), ate);
    doc.setLineDashPattern([0.6, 0.6], 0);
    doc.setDrawColor(200, 200, 200);
    for (const f of cal.feriados.filter((f) => f.data >= inicio && f.data <= fim)) doc.line(x(f.data) + pxDia / 2, topoGrelha, x(f.data) + pxDia / 2, ate);
    doc.setLineDashPattern([], 0);
    doc.setDrawColor(...LINHA);
    doc.line(M, topoGrelha, L - M, topoGrelha);
  };

  const linhaHoje = (ate: number) => {
    if (hoje < inicio || hoje > fim) return;
    doc.setDrawColor(...HOJE);
    doc.setLineWidth(0.5);
    doc.line(x(hoje) + pxDia / 2, topoGrelha - 1, x(hoje) + pxDia / 2, ate);
    doc.setLineWidth(0.2);
  };

  cabecalho();
  let y = topoGrelha + 1;
  // As linhas de cada página desenham-se por cima da grelha; a grelha guarda-se para o fim da página.
  const linhas: ((yy: number) => void)[] = [];
  const alturas: number[] = [];
  const fecharPagina = (ate: number) => {
    grelha(ate);
    let yy = topoGrelha + 1;
    linhas.forEach((f, i) => { f(yy); yy += alturas[i]; });
    linhaHoje(ate);
    linhas.length = 0;
    alturas.length = 0;
  };
  const juntar = (h: number, f: (yy: number) => void) => {
    if (y + h > fundo) {
      fecharPagina(y);
      doc.addPage();
      cabecalho();
      y = topoGrelha + 1;
    }
    linhas.push(f);
    alturas.push(h);
    y += h;
  };

  const varios = new Set(planos.map((p) => ensinoDe(p.disciplina))).size > 1;
  planos.forEach((p, idx) => {
    const d = p.disciplina;
    const cor = rgb(d.cor);
    const geral = ehGeral(d);
    const periodos = e.periodosTurma.filter((pt) => pt.turma === d.turma);
    const quebras = quebrasDe(cal, periodos, ausencias, d.diasSemAula, d.id);
    if (varios && (idx === 0 || ensinoDe(planos[idx - 1].disciplina) !== ensinoDe(d))) {
      juntar(6, (yy) => {
        doc.setDrawColor(40, 40, 40);
        doc.setLineWidth(0.6);
        doc.line(M, yy, L - M, yy);
        doc.setLineWidth(0.2);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(...CINZA);
        doc.text(`ENSINO ${ENSINOS.find((x) => x.id === ensinoDe(d))!.nome.toUpperCase()}`, M + 1, yy + 4);
      });
    }
    if (!geral) {
      juntar(6, (yy) => {
        doc.setFillColor(...claro(cor, 0.88));
        doc.rect(M, yy, rot - 1, 6, 'F');
        doc.setFillColor(...cor);
        doc.rect(M, yy, 1.2, 6, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(20, 20, 20);
        const falta = p.temposNecessarios - p.temposDisponiveis;
        doc.text(caber(doc, `${d.turma} | ${d.nome}`, rot - 5), M + 2.5, yy + 4.1);
        if (falta > 0) {
          doc.setFontSize(6);
          doc.setTextColor(...AVISO);
          doc.text(`faltam ${quantidade(falta, d, cal)}`, x0 + 1, yy + 4.1);
        }
      });
    }
    for (const pm of p.modulos) {
      const m = pm.modulo;
      juntar(8, (yy) => {
        doc.setDrawColor(...LINHA);
        doc.line(M, yy + 8, L - M, yy + 8);
        if (geral) {
          doc.setFillColor(...cor);
          doc.rect(M, yy, 1.2, 8, 'F');
        }
        doc.setFont('helvetica', geral ? 'bold' : 'normal');
        doc.setFontSize(7.2);
        doc.setTextColor(20, 20, 20);
        const nome = geral ? `${d.turma} | ${d.nome}` : `${m.codigo ? `${m.codigo} · ` : ''}${m.nome}`;
        // Aviso de que não cabe: na 1.ª linha, à direita; o nome encolhe para lhe dar lugar.
        let espacoNome = rot - 5;
        if (pm.emFalta > 0) {
          const aviso = `não cabe: faltam ${quantidade(pm.emFalta, d, cal)}`;
          doc.setFontSize(5.8);
          doc.setTextColor(...AVISO);
          doc.text(aviso, M + rot - 3, yy + 3.4, { align: 'right' });
          espacoNome -= doc.getTextWidth(aviso) + 2;
          doc.setFontSize(7.2);
          doc.setTextColor(20, 20, 20);
        }
        doc.text(caber(doc, nome, espacoNome), M + 2.5, yy + 3.4);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.8);
        doc.setTextColor(...CINZA);
        // Datas e quanto já foi dado do total (ex.: "dadas 10 h de 25 h (40%)").
        const pct = pm.totalTempos ? Math.round((pm.dados / pm.totalTempos) * 100) : 0;
        const dadas = `${geral ? 'dados' : 'dadas'} ${dadoDoTotal(pm.dados, pm.totalTempos, d, cal)} (${pct}%)`;
        doc.text(pm.inicio ? caber(doc, `${fmtShort(pm.inicio)} a ${fmtShort(pm.fim!)} · ${dadas}`, rot - 5) : 'sem aulas marcadas', M + 2.5, yy + 6.4);
        // Barras: claras; a parte já dada, na cor cheia.
        const lista = trocos(pm, quebras);
        for (const [a, b] of lista) {
          const ini = x(a);
          const w = Math.max(0.6, x(b) + pxDia - ini);
          doc.setFillColor(...claro(cor, 0.55));
          doc.roundedRect(ini, yy + 3.4, w, 2.8, 0.6, 0.6, 'F');
          const corte = Math.min(Math.max(x(hoje) + pxDia, ini), ini + w);
          if (corte > ini) {
            doc.setFillColor(...cor);
            doc.roundedRect(ini, yy + 3.4, corte - ini, 2.8, 0.6, 0.6, 'F');
          }
        }
        // Datas de início e fim de cada troço, por cima da barra; num troço curto, uma só ("12/02–15/02").
        // Uma data que tape a anterior desliza para a direita.
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5);
        doc.setTextColor(60, 60, 60);
        let ultimoFim = -Infinity;
        for (const [a, b] of lista) {
          const ini = x(a);
          const fimX = x(b) + pxDia;
          const textos: [string, number][] = a === b || fimX - ini < 16
            ? [[a === b ? fmtShort(a) : `${fmtShort(a)}–${fmtShort(b)}`, (ini + fimX) / 2]]
            : [[fmtShort(a), ini + doc.getTextWidth(fmtShort(a)) / 2], [fmtShort(b), fimX - doc.getTextWidth(fmtShort(b)) / 2]];
          for (const [t, centro] of textos) {
            const w = doc.getTextWidth(t);
            const esq = Math.min(Math.max(centro - w / 2, ultimoFim + 0.8), L - M - w);
            doc.text(t, esq, yy + 2.8);
            ultimoFim = esq + w;
          }
        }
        // Tarefas: losango (um dia) ou traço (período).
        for (const t of m.tarefas.filter((t) => t.data)) {
          const c: RGB = t.feita ? [47, 125, 79] : (t.fim ?? t.data!) < hoje ? HOJE : cor;
          doc.setFillColor(...c);
          if (t.fim) doc.rect(x(t.data!), yy + 6.7, Math.max(0.6, x(t.fim) + pxDia - x(t.data!)), 0.7, 'F');
          else {
            const cx = x(t.data!) + pxDia / 2, cy = yy + 4.8, r = 1.3;
            doc.triangle(cx - r, cy, cx, cy - r, cx + r, cy, 'F');
            doc.triangle(cx - r, cy, cx, cy + r, cx + r, cy, 'F');
          }
        }
      });
    }
  });
  fecharPagina(y);

  // Legenda
  doc.setPage(doc.getNumberOfPages());
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...CINZA);
  const legenda = cal.interrupcoes.map((i) => `${i.nome} ${fmtShort(i.inicio)}–${fmtShort(i.fim)}`).join(' | ');
  doc.text(caber(doc, `${legenda}. Linhas tracejadas: feriados. Vermelho: hoje.${ausencias.some((a) => !a.disciplinaId && !a.conta) ? ' Laranja: dias sem aulas.' : ''}`, L - 2 * M), M, A - 9);
  rodape(doc);
  return doc;
}

const DIAS_EXTENSO = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/** Horário da semana que começa em "segunda", com a UC de cada aula e as aulas que não houve. */
export async function pdfHorario(e: Estado, planos: PlanoDisciplina[], segunda: ISODate, titulo: string, docente?: string): Promise<jsPDF> {
  const doc = await novoDoc();
  const blocos = blocosDoEstado(e);
  const lado = faixas(blocos);
  const nDias = blocos.some((b) => b.dia === 5) ? 6 : 5;
  const ini = blocos.length ? Math.min(...blocos.map((b) => Math.floor(minutos(b.inicio) / 60) * 60)) : 8 * 60;
  const fim = blocos.length ? Math.max(...blocos.map((b) => Math.ceil(minutos(b.fim) / 60) * 60)) : 18 * 60;
  const topo = 30;
  const altura = A - 14 - topo;
  const mm = altura / (fim - ini);
  const xh = M + 12;
  const col = (L - M - xh) / nDias;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  doc.text('Horário', M, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...CINZA);
  doc.text([docente, e.calendario.escola, titulo].filter(Boolean).join(' · '), M, 19.5);

  // Dias
  for (let i = 0; i < nDias; i++) {
    const data = addDays(segunda, i);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(20, 20, 20);
    doc.text(`${DIAS_EXTENSO[i]} ${Number(data.slice(8, 10))}`, xh + col * i + col / 2, topo - 3, { align: 'center' });
  }
  // Horas e linhas
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setDrawColor(...LINHA);
  doc.setLineWidth(0.2);
  for (let m = ini; m <= fim; m += 60) {
    const y = topo + (m - ini) * mm;
    doc.setTextColor(...CINZA);
    doc.text(`${String(m / 60).padStart(2, '0')}:00`, xh - 2, y + 1, { align: 'right' });
    doc.line(xh, y, L - M, y);
  }
  for (let i = 0; i <= nDias; i++) doc.line(xh + col * i, topo, xh + col * i, topo + altura);

  const moduloNoDia = (dId: string, data: ISODate) =>
    planos.find((p) => p.disciplina.id === dId)?.modulos.find((m) => m.sessoes.some((s) => s.data === data))?.modulo;

  for (const b of blocos) {
    if (b.dia >= nDias) continue;
    const data = addDays(segunda, b.dia);
    const d = e.disciplinas.find((x) => x.id === b.disciplinaId);
    const sa = semAulaNoBloco(e, blocos, b, data);
    const mod = d && !sa ? moduloNoDia(d.id, data) : undefined;
    const { faixa, n } = lado.get(b.id) ?? { faixa: 0, n: 1 };
    const w = col / n;
    const bx = xh + col * b.dia + w * faixa + 0.6;
    const by = topo + (minutos(b.inicio) - ini) * mm + 0.4;
    const bw = w - 1.2;
    const bh = (minutos(b.fim) - minutos(b.inicio)) * mm - 0.8;
    const cor: RGB = d ? rgb(d.cor) : [170, 170, 170];
    doc.setFillColor(...(sa ? claro(AVISO, 0.8) : claro(cor, ehAula(b) ? 0.82 : 0.9)));
    doc.roundedRect(bx, by, bw, bh, 0.8, 0.8, 'F');
    doc.setFillColor(...cor);
    doc.rect(bx, by, 1, bh, 'F');
    doc.setTextColor(20, 20, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    const nome = ehAula(b) ? sigla(b.titulo) : b.titulo;
    doc.text(caber(doc, nome, bw - 3), bx + 2, by + 3.4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...CINZA);
    const linha2 = [nomeTurmas(b.turmas), b.sala].filter(Boolean).join(' · ');
    if (linha2 && bh > 6) doc.text(caber(doc, linha2, bw - 3), bx + 2, by + 6.3);
    const linha3 = sa ? sa.motivo : mod && !mod.anual ? (mod.codigo ? mod.codigo.replace(/^UC0*/, '') : mod.nome) : '';
    if (linha3 && bh > 9) {
      doc.setTextColor(...(sa ? AVISO : cor));
      doc.text(caber(doc, linha3, bw - 3), bx + 2, by + 9);
    }
  }
  rodape(doc);
  return doc;
}

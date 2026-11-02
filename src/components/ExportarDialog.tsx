import { useState } from 'react';
import { addDays, weekday } from '../lib/dates';
import type { PlanoDisciplina } from '../lib/engine';
import { entregar, pdfCronograma, pdfHorario } from '../lib/exportarPdf';
import type { Estado, ISODate } from '../lib/types';

interface Props {
  estado: Estado;
  /** Pela ordem do cronograma (agrupados por ensino). */
  planos: PlanoDisciplina[];
  hoje: ISODate;
  /** Turma escolhida no filtro: só essas vêm marcadas. */
  turma?: string;
  tipo: 'cronograma' | 'horario';
  onFechar: () => void;
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function segundaDe(iso: ISODate): ISODate {
  const d = weekday(iso);
  return d >= 5 ? addDays(iso, 7 - d) : addDays(iso, -d);
}

function semanaTexto(seg: ISODate): string {
  const fim = addDays(seg, 4);
  const [, m1, d1] = seg.split('-').map(Number);
  const [, m2, d2] = fim.split('-').map(Number);
  return m1 === m2 ? `${d1} a ${d2} de ${MESES[m1 - 1]}` : `${d1} de ${MESES[m1 - 1]} a ${d2} de ${MESES[m2 - 1]}`;
}

/** Exportar em PDF: o cronograma (todas ou algumas disciplinas) ou o horário de uma semana. */
export function ExportarDialog({ estado, planos, hoje, turma, tipo: tipoInicial, onFechar }: Props) {
  const [tipo, setTipo] = useState(tipoInicial);
  const [escolhidas, setEscolhidas] = useState(() => new Set(planos.filter((p) => !turma || p.disciplina.turma === turma).map((p) => p.disciplina.id)));
  const [segunda, setSegunda] = useState(() => segundaDe(hoje));
  const [aFazer, setAFazer] = useState(false);
  const [erro, setErro] = useState('');

  const alternar = (id: string) => setEscolhidas((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const exportar = async () => {
    setAFazer(true);
    setErro('');
    try {
      if (tipo === 'cronograma') {
        const lista = planos.filter((p) => escolhidas.has(p.disciplina.id));
        const turmas = [...new Set(lista.map((p) => p.disciplina.turma))];
        const subtitulo = lista.length === planos.length ? 'Todas as disciplinas'
          : lista.length === 1 ? `${lista[0].disciplina.turma} | ${lista[0].disciplina.nome}`
          : turmas.length === 1 && lista.length === planos.filter((p) => p.disciplina.turma === turmas[0]).length ? `Turma ${turmas[0]}`
          : lista.map((p) => `${p.disciplina.turma} | ${p.disciplina.nome}`).join(', ');
        const doc = await pdfCronograma(estado, lista, hoje, subtitulo);
        const nome = lista.length === 1 ? `${lista[0].disciplina.turma} ${lista[0].disciplina.nome}` : turmas.length === 1 ? turmas[0] : 'todas';
        await entregar(doc, `Cronograma ${nome}.pdf`.replace(/[\\/:*?"<>|]/g, '-'));
      } else {
        const doc = await pdfHorario(estado, planos, segunda, semanaTexto(segunda));
        await entregar(doc, `Horário ${segunda.split('-').reverse().join('-')}.pdf`);
      }
      onFechar();
    } catch (e) {
      setErro(`Não foi possível criar o PDF: ${(e as Error).message}`);
    } finally {
      setAFazer(false);
    }
  };

  return (
    <div className="sheet-backdrop center" onClick={onFechar}>
      <div className="dialog exportar" role="dialog" aria-modal="true" aria-label="Exportar PDF" onClick={(e) => e.stopPropagation()}>
        <h2>Exportar PDF</h2>
        <div className="seg" role="radiogroup" aria-label="O quê">
          <button type="button" role="radio" aria-checked={tipo === 'cronograma'} className={tipo === 'cronograma' ? 'on' : ''} onClick={() => setTipo('cronograma')}>Cronograma</button>
          <button type="button" role="radio" aria-checked={tipo === 'horario'} className={tipo === 'horario' ? 'on' : ''} onClick={() => setTipo('horario')}>Horário</button>
        </div>

        {tipo === 'cronograma' ? (
          <>
            <div className="row wrap">
              <button type="button" className="link-btn small" onClick={() => setEscolhidas(new Set(planos.map((p) => p.disciplina.id)))}>Todas</button>
              <button type="button" className="link-btn small" onClick={() => setEscolhidas(new Set())}>Nenhuma</button>
            </div>
            <ul className="check-list exportar-lista">
              {planos.map((p) => (
                <li key={p.disciplina.id}>
                  <label>
                    <input type="checkbox" checked={escolhidas.has(p.disciplina.id)} onChange={() => alternar(p.disciplina.id)} />
                    <span className="swatch-mini" style={{ background: p.disciplina.cor }} />
                    {p.disciplina.turma} | {p.disciplina.nome || 'Sem nome'}
                  </label>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="row exportar-semana">
            <button className="icon-btn" onClick={() => setSegunda((s) => addDays(s, -7))} aria-label="Semana anterior">‹</button>
            <strong>{semanaTexto(segunda)}</strong>
            <button className="icon-btn" onClick={() => setSegunda((s) => addDays(s, 7))} aria-label="Semana seguinte">›</button>
          </div>
        )}

        {erro && <p className="warn">{erro}</p>}
        <div className="row wrap end">
          <button className="btn" onClick={onFechar}>Cancelar</button>
          <button className="btn primary" disabled={aFazer || (tipo === 'cronograma' && !escolhidas.size)} onClick={exportar}>
            {aFazer ? 'A criar...' : 'Exportar PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}

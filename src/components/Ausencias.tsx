import { useState } from 'react';
import { addDays, fmtLong, uid, weekday } from '../lib/dates';
import { limitesDisciplina, motivoSemAula } from '../lib/engine';
import { MOTIVOS_AUSENCIA, type Ausencia, type Estado } from '../lib/types';
import { IconTrash } from './icons';

interface Props {
  estado: Estado;
  atualizar: (f: (e: Estado) => Estado) => void;
}

/** Tempos de aula que a falta tira, somando todas as disciplinas. */
export function temposPerdidos(a: Pick<Ausencia, 'inicio' | 'fim'>, estado: Estado): number {
  let total = 0;
  for (const d of estado.disciplinas) {
    const { inicio, fim } = limitesDisciplina(d, estado.calendario);
    for (let data = a.inicio; data <= a.fim; data = addDays(data, 1)) {
      if (data < inicio || data > fim) continue;
      const t = d.tempos[weekday(data)] ?? 0;
      if (t > 0 && !motivoSemAula(data, estado.calendario, d.turma, estado.periodosTurma, d.diasSemAula)) total += t;
    }
  }
  return total;
}

/** Faltas do professor: greve, doença, formação. Partem a linha de todas as disciplinas. */
export function Ausencias({ estado, atualizar }: Props) {
  const lista = [...(estado.ausencias ?? [])].sort((a, b) => a.inicio.localeCompare(b.inicio));
  const [motivo, setMotivo] = useState(MOTIVOS_AUSENCIA[0]);
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');

  const adicionar = () => {
    if (!inicio) return;
    const nova: Ausencia = { id: uid(), nome: motivo, inicio, fim: fim && fim > inicio ? fim : inicio };
    atualizar((e) => ({ ...e, ausencias: [...(e.ausencias ?? []), nova] }));
    setInicio('');
    setFim('');
  };
  const apagar = (id: string) => atualizar((e) => ({ ...e, ausencias: (e.ausencias ?? []).filter((a) => a.id !== id) }));

  return (
    <section className="card plain ausencias">
      <h2>Faltas do professor</h2>
      <p className="muted small">Greve, doença, formação. Em todas as disciplinas; no profissional, os módulos avançam.</p>
      {lista.length > 0 && (
        <ul className="ausencias-lista">
          {lista.map((a) => {
            const t = temposPerdidos(a, estado);
            return (
              <li key={a.id}>
                <span className="grow">
                  <strong>{a.nome}</strong> {a.inicio === a.fim ? fmtLong(a.inicio) : `${fmtLong(a.inicio)} a ${fmtLong(a.fim)}`}
                  <small className="muted"> · {t} {t === 1 ? 'tempo' : 'tempos'}</small>
                </span>
                <button className="icon-btn" onClick={() => apagar(a.id)} aria-label={`Apagar falta de ${fmtLong(a.inicio)}`}><IconTrash /></button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="row wrap ausencias-form">
        <select value={motivo} onChange={(e) => setMotivo(e.target.value)} aria-label="Motivo">
          {MOTIVOS_AUSENCIA.map((m) => <option key={m}>{m}</option>)}
        </select>
        <label>De <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} aria-label="Primeiro dia" /></label>
        <label>a <input type="date" value={fim} min={inicio || undefined} onChange={(e) => setFim(e.target.value)} aria-label="Último dia (opcional)" /></label>
        <button className="btn" disabled={!inicio} onClick={adicionar}>Adicionar falta</button>
      </div>
    </section>
  );
}

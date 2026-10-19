import { DIAS_SEMANA, fmtShort } from '../lib/dates';
import type { PlanoDisciplina } from '../lib/engine';
import { COMPONENTES, type Estado } from '../lib/types';
import { Ausencias } from './Ausencias';

/** Horário só para consulta (telemóvel). */
export function HorarioLeitura({ planos, onAbrir, estado, atualizar }: {
  planos: PlanoDisciplina[];
  onAbrir: (d: string, m: string) => void;
  estado: Estado;
  atualizar: (f: (e: Estado) => Estado) => void;
}) {
  if (!planos.length) return <div className="page"><h1>Horário</h1><div className="empty"><p>Sem dados.</p></div></div>;
  return (
    <div className="page">
      <h1>Horário</h1>
      {/* No telemóvel também se marcam dias sem aulas (greve, doença): o cronograma acerta logo. */}
      <Ausencias estado={estado} atualizar={atualizar} />
      {planos.map((p) => {
        const d = p.disciplina;
        const dias = d.tempos.map((t, i) => (t > 0 ? `${DIAS_SEMANA[i]} ${t}` : '')).filter(Boolean).join(' · ');
        return (
          <article key={d.id} className="card leitura" style={{ ['--cor' as string]: d.cor }}>
            <header>
              <strong>{d.turma} | {d.nome}</strong>
              <small>{COMPONENTES.find((c) => c.id === d.componente)?.nome} · {dias || 'sem tempos'}</small>
            </header>
            <ul>
              {p.modulos.map((pm) => {
                const pct = pm.totalTempos ? Math.round((pm.dados / pm.totalTempos) * 100) : 0;
                return (
                  <li key={pm.modulo.id}>
                    <button type="button" onClick={() => onAbrir(d.id, pm.modulo.id)}>
                      <span className="leitura-linha">
                        <span className="leitura-nome">
                          {pm.modulo.codigo && <span className="mono">{pm.modulo.codigo} </span>}
                          {pm.modulo.nome}
                        </span>
                        <small>
                          {pm.inicio ? `${fmtShort(pm.inicio)}–${fmtShort(pm.fim!)}` : '—'} · {pm.totalTempos} t
                        </small>
                      </span>
                      <span className="mod-progress"><span style={{ width: `${pct}%` }} /></span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </article>
        );
      })}
    </div>
  );
}

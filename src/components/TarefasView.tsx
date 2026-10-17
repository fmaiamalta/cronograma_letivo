import { useState } from 'react';
import { addDays, fmtLong } from '../lib/dates';
import type { Estado, Tarefa } from '../lib/types';

interface Props {
  estado: Estado;
  hoje: string;
  onAlternar: (disciplinaId: string, moduloId: string, tarefaId: string) => void;
  onAbrir: (disciplinaId: string, moduloId: string) => void;
}

interface Linha {
  t: Tarefa;
  dId: string;
  mId: string;
  onde: string;
  cor: string;
}

export function TarefasView({ estado, hoje, onAlternar, onAbrir }: Props) {
  const [verFeitas, setVerFeitas] = useState(false);
  const todas: Linha[] = estado.disciplinas.flatMap((d) =>
    d.modulos.flatMap((m) => m.tarefas.map((t) => ({ t, dId: d.id, mId: m.id, cor: d.cor, onde: `${d.turma} | ${m.codigo ?? m.nome}` }))),
  );
  const ord = (a: Linha, b: Linha) => (a.t.data ?? '9999').localeCompare(b.t.data ?? '9999');
  const pend = todas.filter((x) => !x.t.feita).sort(ord);
  const semana = addDays(hoje, 7);
  const grupos: [string, Linha[]][] = [
    ['Atrasadas', pend.filter((x) => x.t.data && x.t.data < hoje)],
    ['Próximos 7 dias', pend.filter((x) => x.t.data && x.t.data >= hoje && x.t.data <= semana)],
    ['Mais tarde', pend.filter((x) => x.t.data && x.t.data > semana)],
    ['Sem data', pend.filter((x) => !x.t.data)],
  ];
  if (verFeitas) grupos.push(['Feitas', todas.filter((x) => x.t.feita).sort(ord)]);
  const feitas = todas.length - pend.length;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Tarefas</h1>
          <p className="muted">{pend.length} por fazer · {feitas} feitas</p>
        </div>
        <label className="toggle"><input type="checkbox" checked={verFeitas} onChange={(e) => setVerFeitas(e.target.checked)} /> Mostrar feitas</label>
      </div>
      {todas.length === 0 && <div className="empty"><p>Sem tarefas. As tarefas criam-se em cada módulo do cronograma.</p></div>}
      {grupos.filter(([, l]) => l.length).map(([titulo, l]) => (
        <section key={titulo} className="card plain">
          <h2 className={titulo === 'Atrasadas' ? 'warn' : ''}>{titulo}</h2>
          <ul className="task-list">
            {l.map((x) => (
              <li key={x.t.id} className={x.t.feita ? 'done' : ''} style={{ ['--cor' as string]: x.cor }}>
                <label>
                  <input type="checkbox" checked={x.t.feita} onChange={() => onAlternar(x.dId, x.mId, x.t.id)} />
                  <span>{x.t.titulo}</span>
                </label>
                <button className="link-btn" onClick={() => onAbrir(x.dId, x.mId)}>
                  <span className="dot" /> {x.onde}{x.t.data ? ` · ${fmtLong(x.t.data)}` : ''}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

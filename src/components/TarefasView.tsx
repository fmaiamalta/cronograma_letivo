import { useState } from 'react';
import { addDays, fmtLong } from '../lib/dates';
import { prazo, type Estado, type Tarefa } from '../lib/types';

interface Props {
  estado: Estado;
  hoje: string;
  soLeitura?: boolean;
  onAlternar: (disciplinaId: string, moduloId: string, tarefaId: string) => void;
  onAbrir: (disciplinaId: string, moduloId: string) => void;
  onNova: () => void;
  onEditar: (disciplinaId: string, moduloId: string, tarefa: Tarefa) => void;
}

interface Linha {
  t: Tarefa;
  dId: string;
  mId: string;
  onde: string;
  cor: string;
}

export function quandoTarefa(t: Tarefa): string {
  if (!t.data) return '';
  return t.fim ? `${fmtLong(t.data)} a ${fmtLong(t.fim)}` : fmtLong(t.data);
}

export function TarefasView({ estado, hoje, soLeitura, onAlternar, onAbrir, onNova, onEditar }: Props) {
  const [verFeitas, setVerFeitas] = useState(false);
  const todas: Linha[] = estado.disciplinas.flatMap((d) =>
    d.modulos.flatMap((m) =>
      m.tarefas.map((t) => ({ t, dId: d.id, mId: m.id, cor: d.cor, onde: `${d.turma.startsWith(String(d.ano)) ? '' : `${d.ano}.º · `}${d.turma} | ${d.nome} · ${m.codigo ?? m.nome}` })),
    ),
  );
  const ord = (a: Linha, b: Linha) => (a.t.data ?? '9999').localeCompare(b.t.data ?? '9999');
  const pend = todas.filter((x) => !x.t.feita).sort(ord);
  const semana = addDays(hoje, 7);
  // Uma tarefa com período está atrasada só depois do fim; "próximos 7 dias" se já começou ou começa em breve.
  const grupos: [string, Linha[]][] = [
    ['Atrasadas', pend.filter((x) => prazo(x.t) && prazo(x.t)! < hoje)],
    ['Próximos 7 dias', pend.filter((x) => x.t.data && prazo(x.t)! >= hoje && x.t.data <= semana)],
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
          <p className="muted">{pend.length} por fazer · {feitas} {feitas === 1 ? 'feita' : 'feitas'}</p>
        </div>
        <div className="row wrap">
          <label className="toggle"><input type="checkbox" checked={verFeitas} onChange={(e) => setVerFeitas(e.target.checked)} /> Mostrar feitas</label>
          {!soLeitura && <button className="btn primary" onClick={onNova}>+ Nova tarefa</button>}
        </div>
      </div>
      {todas.length === 0 && <div className="empty"><p>Sem tarefas.</p></div>}
      {grupos.filter(([, l]) => l.length).map(([titulo, l]) => (
        <section key={titulo} className="card plain">
          <h2 className={titulo === 'Atrasadas' ? 'warn' : ''}>{titulo}</h2>
          <ul className="task-list tarefas">
            {l.map((x) => (
              <li key={x.t.id} className={x.t.feita ? 'done' : ''} style={{ ['--cor' as string]: x.cor }}>
                <input type="checkbox" checked={x.t.feita} onChange={() => onAlternar(x.dId, x.mId, x.t.id)} aria-label={`Feita: ${x.t.titulo}`} />
                <div className="tarefa-txt">
                  {soLeitura ? (
                    <strong>{x.t.titulo}</strong>
                  ) : (
                    <button className="tarefa-nome" onClick={() => onEditar(x.dId, x.mId, x.t)}>{x.t.titulo}</button>
                  )}
                  {x.t.descricao && <p className="tarefa-desc">{x.t.descricao}</p>}
                  <button className="link-btn tarefa-onde" onClick={() => onAbrir(x.dId, x.mId)}>
                    <span className="dot" /> {x.onde}
                  </button>
                </div>
                <span className="tarefa-quando">{quandoTarefa(x.t)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

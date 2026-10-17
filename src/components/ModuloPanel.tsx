import { useState } from 'react';
import { fmtLong, todayISO, uid } from '../lib/dates';
import type { PlanoDisciplina, PlanoModulo } from '../lib/engine';
import type { Modulo, Tarefa } from '../lib/types';
import { IconTrash } from './icons';

interface Props {
  plano: PlanoDisciplina;
  pm: PlanoModulo;
  hoje: string;
  onMudar: (f: (m: Modulo) => Modulo) => void;
  onFechar: () => void;
  onEditar: () => void;
}

export function ModuloPanel({ plano, pm, hoje, onMudar, onFechar, onEditar }: Props) {
  const m = pm.modulo;
  const [titulo, setTitulo] = useState('');
  const [data, setData] = useState(pm.inicio && pm.inicio > hoje ? pm.inicio : todayISO());
  const [verAulas, setVerAulas] = useState(false);
  const pct = pm.totalTempos ? Math.round((pm.dados / pm.totalTempos) * 100) : 0;

  const mudarTarefa = (id: string, f: (t: Tarefa) => Tarefa | null) =>
    onMudar((mod) => ({ ...mod, tarefas: mod.tarefas.map((t) => (t.id === id ? f(t) : t)).filter(Boolean) as Tarefa[] }));

  const adicionar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) return;
    onMudar((mod) => ({ ...mod, tarefas: [...mod.tarefas, { id: uid(), titulo: titulo.trim(), data: data || undefined, feita: false }] }));
    setTitulo('');
  };

  const tarefas = [...m.tarefas].sort((a, b) => (a.data ?? '9999').localeCompare(b.data ?? '9999'));

  return (
    <div className="sheet-backdrop" onClick={onFechar}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={m.nome} onClick={(e) => e.stopPropagation()} style={{ ['--cor' as string]: plano.disciplina.cor }}>
        <header className="sheet-head">
          <div>
            <small>{plano.disciplina.turma} | {plano.disciplina.nome}</small>
            <h2>{m.codigo ? `${m.codigo} · ` : ''}{m.nome}</h2>
          </div>
          <button className="icon-btn" onClick={onFechar} aria-label="Fechar">✕</button>
        </header>

        <dl className="facts">
          <div><dt>Início</dt><dd>{pm.inicio ? fmtLong(pm.inicio) : '—'}</dd></div>
          <div><dt>Fim</dt><dd>{pm.fim ? fmtLong(pm.fim) : '—'}</dd></div>
          <div><dt>Duração</dt><dd>{pm.totalTempos} tempos{m.unidade === 'h' ? ` (${m.quantidade} h)` : ''}</dd></div>
          <div><dt>Aulas</dt><dd>{pm.sessoes.length}</dd></div>
        </dl>

        <div className="progress-block">
          <div className="progress-label">
            <span>Dados até hoje</span>
            <strong>{pm.dados} de {pm.totalTempos} tempos ({pct}%)</strong>
          </div>
          <div className="progress"><span style={{ width: `${pct}%` }} /></div>
          {pm.emFalta > 0 && <p className="warn">Faltam {pm.emFalta} tempos que não cabem até ao fim do ano letivo.</p>}
        </div>

        <h3>Tarefas</h3>
        {tarefas.length === 0 && <p className="muted">Ainda não há tarefas. Ex.: "Entregar trabalho 1", "Teste", "Apresentação oral".</p>}
        <ul className="task-list">
          {tarefas.map((t) => (
            <li key={t.id} className={t.feita ? 'done' : t.data && t.data < hoje ? 'late' : ''}>
              <label>
                <input type="checkbox" checked={t.feita} onChange={() => mudarTarefa(t.id, (x) => ({ ...x, feita: !x.feita }))} />
                <span>{t.titulo}</span>
              </label>
              <input type="date" value={t.data ?? ''} onChange={(e) => mudarTarefa(t.id, (x) => ({ ...x, data: e.target.value || undefined }))} aria-label="Data da tarefa" />
              <button className="icon-btn" onClick={() => mudarTarefa(t.id, () => null)} aria-label={`Apagar ${t.titulo}`}><IconTrash /></button>
            </li>
          ))}
        </ul>
        <form className="task-add" onSubmit={adicionar}>
          <input placeholder="Nova tarefa" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} aria-label="Data" />
          <button className="btn primary" type="submit">Adicionar</button>
        </form>

        <button className="link-btn" onClick={() => setVerAulas((v) => !v)}>
          {verAulas ? 'Esconder' : 'Ver'} as {pm.sessoes.length} aulas
        </button>
        {verAulas && (
          <ol className="aulas">
            {pm.sessoes.map((s, i) => (
              <li key={s.data} className={s.data <= hoje ? 'past' : ''}>
                <span>Aula {i + 1}</span> <span>{fmtLong(s.data)}</span> <span>{s.tempos} t</span>
              </li>
            ))}
          </ol>
        )}

        <footer className="sheet-foot">
          <button className="btn" onClick={onEditar}>Editar disciplina</button>
        </footer>
      </div>
    </div>
  );
}

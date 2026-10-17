import { useState } from 'react';
import { DIAS_SEMANA, fmtLong, uid } from '../lib/dates';
import { normalizarCodigo, pesquisarCatalogo, procurarCodigo } from '../lib/catalog';
import { temposDoModulo, type PlanoDisciplina } from '../lib/engine';
import { CORES } from '../lib/presets';
import { type Ano, type Disciplina, type Estado, type Modulo, type PeriodoTurma } from '../lib/types';
import { DisciplinaPicker, type Escolha } from './DisciplinaPicker';
import { IconDown, IconTrash, IconUp } from './icons';

interface Props {
  estado: Estado;
  planos: PlanoDisciplina[];
  aberta: string | null;
  setAberta: (id: string | null) => void;
  atualizar: (f: (e: Estado) => Estado) => void;
  onExemplo: () => void;
}

export function HorarioView({ estado, planos, aberta, setAberta, atualizar, onExemplo }: Props) {
  const turmas = [...new Set(estado.disciplinas.map((d) => d.turma).filter(Boolean))].sort();

  const novaDisciplina = () => {
    const d: Disciplina = {
      id: uid(),
      turma: turmas[0] ?? '',
      nome: '',
      ano: 10,
      componente: 'tecnologica',
      cor: CORES[estado.disciplinas.length % CORES.length],
      tempos: [0, 0, 0, 0, 0, 0, 0],
      diasSemAula: [],
      modulos: [],
    };
    atualizar((e) => ({ ...e, disciplinas: [...e.disciplinas, d] }));
    setAberta(d.id);
  };

  const mudar = (id: string, f: (d: Disciplina) => Disciplina) =>
    atualizar((e) => ({ ...e, disciplinas: e.disciplinas.map((d) => (d.id === id ? f(d) : d)) }));

  const apagar = (id: string) => {
    const d = estado.disciplinas.find((x) => x.id === id);
    if (!confirm(`Apagar "${d?.turma} | ${d?.nome || 'sem nome'}" e todas as suas tarefas?`)) return;
    atualizar((e) => ({ ...e, disciplinas: e.disciplinas.filter((x) => x.id !== id) }));
  };

  const mover = (id: string, delta: number) =>
    atualizar((e) => {
      const lista = [...e.disciplinas];
      const i = lista.findIndex((d) => d.id === id);
      const j = i + delta;
      if (j < 0 || j >= lista.length) return e;
      [lista[i], lista[j]] = [lista[j], lista[i]];
      return { ...e, disciplinas: lista };
    });

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Horário</h1>
          <p className="muted">Uma entrada por disciplina e turma.</p>
        </div>
        <button className="btn primary" onClick={novaDisciplina}>+ Disciplina</button>
      </div>

      {estado.disciplinas.length === 0 && (
        <div className="empty">
          <p>Sem disciplinas.</p>
          <div className="row">
            <button className="btn primary" onClick={novaDisciplina}>Nova disciplina</button>
            <button className="btn" onClick={onExemplo}>Carregar um exemplo</button>
          </div>
        </div>
      )}

      <datalist id="turmas">{turmas.map((t) => <option key={t} value={t} />)}</datalist>

      {estado.disciplinas.map((d, idx) => {
        const plano = planos.find((p) => p.disciplina.id === d.id);
        const aberto = aberta === d.id;
        const semanal = d.tempos.reduce((a, b) => a + b, 0);
        return (
          <article key={d.id} className="card" style={{ ['--cor' as string]: d.cor }}>
            <header className="card-head" onClick={() => setAberta(aberto ? null : d.id)}>
              <span className="swatch" />
              <div className="grow">
                <strong>{d.turma || 'Turma?'} | {d.nome || 'Disciplina sem nome'}</strong>
                <small>
                  {semanal} tempos/semana · {d.modulos.length} {d.modulos.length === 1 ? 'módulo' : 'módulos'}
                  {plano && plano.temposNecessarios > plano.temposDisponiveis && (
                    <span className="warn"> · faltam {plano.temposNecessarios - plano.temposDisponiveis} tempos</span>
                  )}
                </small>
              </div>
              <div className="row" onClick={(e) => e.stopPropagation()}>
                <button className="icon-btn" onClick={() => mover(d.id, -1)} disabled={idx === 0} aria-label="Subir"><IconUp /></button>
                <button className="icon-btn" onClick={() => mover(d.id, 1)} disabled={idx === estado.disciplinas.length - 1} aria-label="Descer"><IconDown /></button>
              </div>
              <span className="chevron">{aberto ? '▴' : '▾'}</span>
            </header>
            {aberto && (
              <EditorDisciplina
                d={d}
                estado={estado}
                plano={plano}
                mudar={(f) => mudar(d.id, f)}
                apagar={() => apagar(d.id)}
              />
            )}
          </article>
        );
      })}

      <PeriodosTurma estado={estado} turmas={turmas} atualizar={atualizar} />
    </div>
  );
}

function EditorDisciplina({ d, estado, plano, mudar, apagar }: {
  d: Disciplina;
  estado: Estado;
  plano?: PlanoDisciplina;
  mudar: (f: (d: Disciplina) => Disciplina) => void;
  apagar: () => void;
}) {
  const [diaSemAula, setDiaSemAula] = useState('');
  const [procura, setProcura] = useState('');
  const mpt = estado.calendario.minutosPorTempo;
  const set = <K extends keyof Disciplina>(k: K, v: Disciplina[K]) => mudar((x) => ({ ...x, [k]: v }));

  const mudarModulo = (id: string, f: (m: Modulo) => Modulo) =>
    mudar((x) => ({ ...x, modulos: x.modulos.map((m) => (m.id === id ? f(m) : m)) }));

  const moverModulo = (i: number, delta: number) =>
    mudar((x) => {
      const l = [...x.modulos];
      const j = i + delta;
      if (j < 0 || j >= l.length) return x;
      [l[i], l[j]] = [l[j], l[i]];
      return { ...x, modulos: l };
    });

  const addModulo = (codigo = '') => {
    const e = codigo ? procurarCodigo(estado.catalogo, codigo) : undefined;
    const m: Modulo = { id: uid(), codigo: e?.codigo, nome: e?.nome ?? '', quantidade: e?.horas ?? 25, unidade: 'h', tarefas: [] };
    mudar((x) => ({ ...x, modulos: [...x.modulos, m] }));
  };

  /** Ao escrever o código, preenche nome e horas a partir do catálogo. */
  const mudarCodigo = (m: Modulo, valor: string) => {
    const e = procurarCodigo(estado.catalogo, valor);
    mudarModulo(m.id, (x) =>
      e ? { ...x, codigo: e.codigo, nome: e.nome, quantidade: e.horas, unidade: 'h' } : { ...x, codigo: valor.toUpperCase() || undefined },
    );
  };

  const escolherDisciplina = (e: Escolha) =>
    mudar((x) => ({
      ...x,
      nome: e.nome,
      componente: e.componente,
      // Uma UC escolhida como disciplina entra logo como módulo, se ainda não estiver.
      modulos:
        e.uc && !x.modulos.some((m) => m.codigo === e.uc!.codigo)
          ? [...x.modulos, { id: uid(), codigo: e.uc.codigo, nome: e.uc.nome, quantidade: e.uc.horas, unidade: 'h', tarefas: [] }]
          : x.modulos,
    }));

  const resultados = procura.trim() ? pesquisarCatalogo(estado.catalogo.filter((c) => c.codigo.startsWith('UC')), procura, 8) : [];

  return (
    <div className="card-body">
      <div className="grid-form">
        <label>Ano
          <select value={d.ano} onChange={(e) => set('ano', Number(e.target.value) as Ano)}>
            <option value={10}>10.º</option><option value={11}>11.º</option><option value={12}>12.º</option>
          </select>
        </label>
        <label>Turma<input list="turmas" value={d.turma} placeholder="10.º M" onChange={(e) => set('turma', e.target.value)} /></label>
        <div className="span-all">
          <span className="field-label">Disciplina</span>
          <DisciplinaPicker nome={d.nome} componente={d.componente} catalogo={estado.catalogo} onEscolher={escolherDisciplina} />
        </div>
        <label>Cor<input type="color" value={d.cor} onChange={(e) => set('cor', e.target.value)} /></label>
      </div>

      <fieldset>
        <legend>Tempos de {mpt} min por dia</legend>
        <div className="week">
          {DIAS_SEMANA.slice(0, 5).map((dia, i) => (
            <label key={dia}>
              {dia}
              <input
                type="number" min={0} max={12} inputMode="numeric"
                value={d.tempos[i] || ''} placeholder="0"
                onChange={(e) => {
                  const t = [...d.tempos];
                  t[i] = Math.max(0, Math.min(12, Number(e.target.value) || 0));
                  set('tempos', t);
                }}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid-form">
        <label>Começa em (opcional)<input type="date" value={d.inicio ?? ''} onChange={(e) => set('inicio', e.target.value || undefined)} /></label>
        <label>Acaba em (opcional)<input type="date" value={d.fim ?? ''} onChange={(e) => set('fim', e.target.value || undefined)} /></label>
      </div>

      <fieldset>
        <legend>Dias sem aula desta disciplina</legend>
        <p className="muted small">Visitas de estudo, reuniões, provas, greves, ...</p>
        <div className="chips">
          {d.diasSemAula.map((x) => (
            <span key={x} className="chip">
              {fmtLong(x)}
              <button onClick={() => set('diasSemAula', d.diasSemAula.filter((y) => y !== x))} aria-label={`Remover ${fmtLong(x)}`}>✕</button>
            </span>
          ))}
        </div>
        <div className="row">
          <input type="date" value={diaSemAula} onChange={(e) => setDiaSemAula(e.target.value)} aria-label="Dia sem aula" />
          <button className="btn" disabled={!diaSemAula} onClick={() => {
            if (!d.diasSemAula.includes(diaSemAula)) set('diasSemAula', [...d.diasSemAula, diaSemAula].sort());
            setDiaSemAula('');
          }}>Adicionar dia</button>
        </div>
      </fieldset>

      <fieldset>
        <legend>UC e módulos, por ordem</legend>
        <div className="mod-list">
          {d.modulos.map((m, i) => {
            const conhecido = m.codigo ? procurarCodigo(estado.catalogo, m.codigo) : undefined;
            const pm = plano?.modulos.find((x) => x.modulo.id === m.id);
            return (
              <div key={m.id} className="mod-edit">
                <span className="mod-n">{i + 1}</span>
                <input className="mod-code" placeholder="Código" defaultValue={m.codigo ?? ''} key={m.codigo ?? 'x'}
                  onBlur={(e) => e.target.value !== (m.codigo ?? '') && mudarCodigo(m, e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  aria-label="Código da UC" />
                <input className="mod-nome" placeholder="Nome do módulo" value={m.nome} onChange={(e) => mudarModulo(m.id, (x) => ({ ...x, nome: e.target.value }))} aria-label="Nome" />
                <input className="mod-qt" type="number" min={1} value={m.quantidade || ''} onChange={(e) => mudarModulo(m.id, (x) => ({ ...x, quantidade: Number(e.target.value) }))} aria-label="Duração" />
                <select value={m.unidade} onChange={(e) => mudarModulo(m.id, (x) => ({ ...x, unidade: e.target.value as 'h' | 't' }))} aria-label="Unidade">
                  <option value="h">horas</option>
                  <option value="t">tempos</option>
                </select>
                <span className="mod-info">
                  {m.unidade === 'h' && `${temposDoModulo(m, estado.calendario.minutosPorTempo)} tempos`}
                  {pm?.inicio && ` · ${fmtLong(pm.inicio)} a ${fmtLong(pm.fim!)}`}
                  {m.codigo && !conhecido && m.codigo.startsWith('UC') && <span className="warn"> · código não está no catálogo</span>}
                </span>
                <div className="row">
                  <button className="icon-btn" onClick={() => moverModulo(i, -1)} disabled={i === 0} aria-label="Subir"><IconUp /></button>
                  <button className="icon-btn" onClick={() => moverModulo(i, 1)} disabled={i === d.modulos.length - 1} aria-label="Descer"><IconDown /></button>
                  <button className="icon-btn" onClick={() => mudar((x) => ({ ...x, modulos: x.modulos.filter((y) => y.id !== m.id) }))} aria-label="Apagar módulo"><IconTrash /></button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="row wrap">
          <button className="btn" onClick={() => addModulo()}>+ Módulo vazio</button>
          <div className="search-add">
            <input placeholder="Procurar UC por código ou nome (ex.: 2634, CSS)" value={procura} onChange={(e) => setProcura(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && procurarCodigo(estado.catalogo, procura)) {
                  addModulo(normalizarCodigo(procura));
                  setProcura('');
                }
              }} />
            {resultados.length > 0 && (
              <ul className="results">
                {resultados.map((r) => (
                  <li key={r.codigo}>
                    <button onClick={() => { addModulo(r.codigo); setProcura(''); }}>
                      <strong>{r.codigo}</strong> {r.nome} <small>{r.horas} h{r.opcional ? ' · opcional' : ''}</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {plano && (
          <p className={'small ' + (plano.temposNecessarios > plano.temposDisponiveis ? 'warn' : 'muted')}>
            Necessários: {plano.temposNecessarios} tempos. Disponíveis até {fmtLong(plano.fim)}: {plano.temposDisponiveis} tempos ({plano.dias.length} dias).
          </p>
        )}
      </fieldset>

      <div className="row end">
        <button className="btn danger" onClick={apagar}>Apagar disciplina</button>
      </div>
    </div>
  );
}

function PeriodosTurma({ estado, turmas, atualizar }: { estado: Estado; turmas: string[]; atualizar: Props['atualizar'] }) {
  const mudar = (id: string, f: (p: PeriodoTurma) => PeriodoTurma | null) =>
    atualizar((e) => ({ ...e, periodosTurma: e.periodosTurma.map((p) => (p.id === id ? f(p) : p)).filter(Boolean) as PeriodoTurma[] }));
  const novo = () =>
    atualizar((e) => ({
      ...e,
      periodosTurma: [...e.periodosTurma, { id: uid(), turma: turmas[0] ?? '', nome: 'FCT', inicio: e.calendario.inicio, fim: e.calendario.inicio }],
    }));
  return (
    <section className="card plain">
      <h2>Períodos sem aulas por turma</h2>
      <p className="muted small">FCT, intercâmbios, semanas de projeto. Aplica-se a toda a turma.</p>
      {estado.periodosTurma.map((p) => (
        <div key={p.id} className="period-row">
          <input list="turmas" value={p.turma} onChange={(e) => mudar(p.id, (x) => ({ ...x, turma: e.target.value }))} aria-label="Turma" placeholder="Turma" />
          <input value={p.nome} onChange={(e) => mudar(p.id, (x) => ({ ...x, nome: e.target.value }))} aria-label="Nome" placeholder="FCT" />
          <input type="date" value={p.inicio} onChange={(e) => mudar(p.id, (x) => ({ ...x, inicio: e.target.value }))} aria-label="Início" />
          <input type="date" value={p.fim} onChange={(e) => mudar(p.id, (x) => ({ ...x, fim: e.target.value }))} aria-label="Fim" />
          <button className="icon-btn" onClick={() => mudar(p.id, () => null)} aria-label="Apagar período"><IconTrash /></button>
        </div>
      ))}
      <button className="btn" onClick={novo} disabled={!turmas.length}>+ Período</button>
    </section>
  );
}

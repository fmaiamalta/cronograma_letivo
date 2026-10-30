import { useState } from 'react';
import { DIAS_SEMANA, fmtLong, uid } from '../lib/dates';
import { codigoVisivel, ehUC, entradaParaModulo, juntarCatalogo, normalizarCodigo, pesquisarCatalogo, procurarCodigo } from '../lib/catalog';
import { limitesDisciplina, temposDoModulo, type PlanoDisciplina } from '../lib/engine';
import { CORES } from '../lib/presets';
import { atividadesDe, aulasDe, blocosDoEstado, fimDaAula, horasDosTempos, lerHoras, minutos, somarMinutos, temposDasAulas } from '../lib/horario';
import { ANOS, COMPONENTES, ehGeral, minutosDe, type Atividade, type Aula, ENSINOS, ensinoDe, type Ano, type Disciplina, type Ensino, type EntradaCatalogo, type Estado, type Modulo, type PeriodoTurma } from '../lib/types';
import { DisciplinaPicker, type Escolha } from './DisciplinaPicker';
import { ImportarHorario } from './ImportarHorario';
import { IconDown, IconTrash, IconUp } from './icons';

interface Props {
  estado: Estado;
  planos: PlanoDisciplina[];
  /** Tempos por dia que vêm do horário importado, por disciplina. */
  temposHorario: Map<string, number[]>;
  aberta: string | null;
  setAberta: (id: string | null) => void;
  atualizar: (f: (e: Estado) => Estado) => void;
  onExemplo: () => void;
}

export function HorarioView({ estado, planos, temposHorario, aberta, setAberta, atualizar, onExemplo }: Props) {
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
          <h1>Disciplinas</h1>
          <p className="muted">Uma entrada por disciplina e turma.</p>
        </div>
        <div className="row wrap">
          <ImportarHorario estado={estado} atualizar={atualizar} />
          <button className="btn primary" onClick={novaDisciplina}>+ Disciplina</button>
        </div>
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
        const semanal = (temposHorario.get(d.id) ?? d.tempos).reduce((a, b) => a + b, 0);
        return (
          <article key={d.id} className="card" style={{ ['--cor' as string]: d.cor }}>
            <header className="card-head" onClick={() => setAberta(aberto ? null : d.id)}>
              <span className="swatch" />
              <div className="grow">
                <strong>{d.turma || 'Turma?'} | {d.nome || 'Disciplina sem nome'}</strong>
                <small>
                  {semanal} {semanal === 1 ? 'tempo' : 'tempos'}/semana · {d.modulos.length} {d.modulos.length === 1 ? 'módulo' : 'módulos'}
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
                atualizar={atualizar}
                d={d}
                doHorario={temposHorario.get(d.id)}
                estado={estado}
                plano={plano}
                mudar={(f) => mudar(d.id, f)}
                apagar={() => apagar(d.id)}
              />
            )}
          </article>
        );
      })}

      <OutrasAtividades estado={estado} atualizar={atualizar} />
      <PeriodosTurma estado={estado} turmas={turmas} atualizar={atualizar} />
    </div>
  );
}

function EditorDisciplina({ d, doHorario, estado, plano, mudar, apagar, atualizar }: {
  atualizar: Props['atualizar'];
  d: Disciplina;
  doHorario?: number[];
  estado: Estado;
  plano?: PlanoDisciplina;
  mudar: (f: (d: Disciplina) => Disciplina) => void;
  apagar: () => void;
}) {
  const [diaSemAula, setDiaSemAula] = useState('');
  const [procura, setProcura] = useState('');
  const mpt = minutosDe(d, estado.calendario);
  // Aulas com dia e hora: fazem o horário e dão os tempos por dia.
  const aulas = aulasDe(d, estado);
  const durAula = estado.calendario.minutosPorTempo;
  const horas = horasDosTempos(estado);
  // Outras aulas e atividades à mesma hora (para avisar).
  const outros = blocosDoEstado(estado).filter((b) => b.disciplinaId !== d.id);
  const sobreposta = (a: Aula) => {
    const ini = minutos(a.inicio), fim = minutos(fimDaAula(a, durAula, horas));
    return outros.find((b) => b.dia === a.dia && minutos(b.inicio) < fim && minutos(b.fim) > ini);
  };
  const setAulas = (lista: Aula[]) => mudar((x) => ({ ...x, aulas: lista, tempos: temposDasAulas(lista) ?? x.tempos }));
  const mudarAula = (id: string, m: Partial<Aula>) => setAulas(aulas.map((a) => (a.id === id ? { ...a, ...m } : a)));
  const novaAula = () => {
    const ult = aulas[aulas.length - 1];
    setAulas([...aulas, ult
      ? { id: uid(), dia: (ult.dia + 1) % 5, inicio: ult.inicio, tempos: ult.tempos, sala: ult.sala }
      : { id: uid(), dia: 0, inicio: '08:15', tempos: 1 }]);
  };
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

  const addModulo = (e?: EntradaCatalogo) => {
    const m: Modulo = { id: uid(), codigo: e && !e.modulo ? e.codigo : undefined, nome: e?.nome ?? '', quantidade: e?.horas ?? 25, unidade: 'h', tarefas: [] };
    mudar((x) => ({ ...x, modulos: [...x.modulos, m] }));
  };

  /**
   * Um módulo escrito à mão passa a fazer parte do catálogo, para se poder
   * escolher noutra disciplina. Uma entrada com código substitui a que o mesmo
   * módulo tinha sem código.
   */
  const registar = (m: Pick<Modulo, 'codigo' | 'nome' | 'quantidade' | 'unidade'>) =>
    atualizar((e) => {
      const nova = entradaParaModulo(e.catalogo, m, d.componente, minutosDe(d, e.calendario));
      if (!nova) return e;
      const resto = nova.modulo ? e.catalogo : e.catalogo.filter((c) => !(c.modulo && c.nome.trim() === nova.nome));
      return { ...e, catalogo: juntarCatalogo(resto, [nova]) };
    });

  /** Ao escrever o código, preenche nome e horas a partir do catálogo. */
  const mudarCodigo = (m: Modulo, valor: string) => {
    const e = procurarCodigo(estado.catalogo, valor);
    const novo: Modulo = e
      ? { ...m, codigo: e.codigo, nome: e.nome, quantidade: e.horas, unidade: 'h' }
      : { ...m, codigo: valor.trim() ? normalizarCodigo(valor) : undefined };
    mudarModulo(m.id, () => novo);
    if (!e) registar(novo);
  };

  const geral = ehGeral(d);
  const doCalendario = limitesDisciplina({ ...d, inicio: undefined, fim: undefined }, estado.calendario);

  /** Ensino geral: um só "módulo" anual com o nome da disciplina (mantém as tarefas). */
  const moduloAnual = (x: Disciplina, nome: string): Modulo[] => {
    const a = x.modulos.find((m) => m.anual);
    return [{ id: a?.id ?? uid(), tarefas: a?.tarefas ?? [], nome, quantidade: 0, unidade: 't', anual: true }];
  };

  /** Mudar de ano ou de ensino; ao mudar de ensino a disciplina escolhida deixa de valer. */
  const mudarNivel = (ano: Ano, ensino: Ensino) =>
    mudar((x) => {
      if (ensinoDe(x) === ensino) return { ...x, ano };
      const componente = COMPONENTES.find((c) => c.ensino === ensino)!.id;
      const modulos = ensino === 'profissional' ? x.modulos.filter((m) => !m.anual) : moduloAnual(x, '');
      return { ...x, ano, ensino, nome: '', componente, modulos };
    });

  const mudarAno = (ano: Ano) => {
    const atual = ensinoDe(d);
    mudarNivel(ano, ano <= 9 ? 'basico' : atual === 'basico' ? 'secundario' : atual);
  };

  const escolherDisciplina = (e: Escolha) =>
    geral
      ? mudar((x) => ({ ...x, nome: e.nome, componente: e.componente, modulos: moduloAnual(x, e.nome) }))
      : mudar((x) => ({
      ...x,
      nome: e.nome,
      componente: e.componente,
      // As UC marcadas entram como módulos, pela ordem em que foram marcadas.
      modulos: [
        ...x.modulos,
        ...(e.ucs ?? [])
          .filter((uc) => !x.modulos.some((m) => (uc.modulo ? !m.codigo && m.nome === uc.nome : m.codigo === uc.codigo)))
          .map((uc) => ({ id: uid(), codigo: uc.modulo ? undefined : uc.codigo, nome: uc.nome, quantidade: uc.horas, unidade: 'h' as const, tarefas: [] })),
      ],
    }));

  const resultados = procura.trim() ? pesquisarCatalogo(estado.catalogo.filter(ehUC), procura, 8) : [];

  return (
    <div className="card-body">
      <div className="grid-form">
        <label>Ano
          <select value={d.ano} onChange={(e) => mudarAno(Number(e.target.value) as Ano)}>
            {ANOS.map((a) => <option key={a} value={a}>{a}.º</option>)}
          </select>
        </label>
        <label>Ensino
          <select value={ensinoDe(d)} onChange={(e) => mudarNivel(d.ano, e.target.value as Ensino)} disabled={d.ano <= 9}>
            {ENSINOS.filter((x) => x.anos.includes(d.ano)).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </select>
        </label>
        <label>Turma<input list="turmas" value={d.turma} placeholder="10.º M" onChange={(e) => set('turma', e.target.value)} /></label>
        <div className="span-all">
          <span className="field-label">Disciplina</span>
          <DisciplinaPicker key={`${ensinoDe(d)}-${d.ano}`} nome={d.nome} componente={d.componente} ensino={ensinoDe(d)} ano={d.ano} catalogo={estado.catalogo} onEscolher={escolherDisciplina} />
        </div>
        <label>Cor<input type="color" value={d.cor} onChange={(e) => set('cor', e.target.value)} /></label>
      </div>

      <fieldset>
        <legend>Aulas na semana</legend>
        <datalist id="horas-tempos">{horas.map((h) => <option key={h} value={h.replace(':', 'h')} />)}</datalist>
        {aulas.length > 0 && (
          <div className="aulas-lista">
            {aulas.map((a) => (
              <div key={a.id} className="aula-linha">
                <select value={a.dia} onChange={(e) => mudarAula(a.id, { dia: Number(e.target.value) })} aria-label="Dia">
                  {DIAS_SEMANA.slice(0, 6).map((n, i) => <option key={n} value={i}>{n}</option>)}
                </select>
                {/* Escolhe-se das horas dos tempos da escola ou escreve-se outra (8h15, 08:15). */}
                <input className="aula-inicio" list="horas-tempos" inputMode="numeric" key={a.inicio} defaultValue={a.inicio.replace(':', 'h')} aria-label="Início"
                  onBlur={(e) => { const h = lerHoras(e.target.value)[0]; if (h && h !== a.inicio) mudarAula(a.id, { inicio: h }); else e.target.value = a.inicio.replace(':', 'h'); }}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
                <label className="aula-tempos">
                  <input type="number" min={1} max={6} inputMode="numeric" value={a.tempos} onChange={(e) => mudarAula(a.id, { tempos: Math.max(1, Math.min(6, Number(e.target.value) || 1)) })} aria-label="Tempos" />
                  {a.tempos === 1 ? 'tempo' : 'tempos'}
                </label>
                <input className="aula-sala" value={a.sala ?? ''} placeholder="Sala" onChange={(e) => mudarAula(a.id, { sala: e.target.value || undefined })} aria-label="Sala" />
                <span className="muted small aula-horas">{a.inicio.replace(':', 'h')}–{fimDaAula(a, durAula, horas).replace(':', 'h')}</span>
                <button className="icon-btn" onClick={() => setAulas(aulas.filter((x) => x.id !== a.id))} aria-label="Apagar aula"><IconTrash /></button>
                {(() => {
                  const b = sobreposta(a);
                  return b && <small className="warn aula-aviso">À mesma hora: {b.titulo}{b.turmas.length ? ` ${b.turmas.join(', ')}` : ''} ({b.inicio.replace(':', 'h')}–{b.fim.replace(':', 'h')})</small>;
                })()}
              </div>
            ))}
          </div>
        )}
        <div className="row wrap">
          <button className="btn" onClick={novaAula}>+ Aula</button>
          {aulas.length > 0 && <span className="muted small">{DIAS_SEMANA.map((n, i) => ((doHorario ?? d.tempos)[i] ? `${n} ${(doHorario ?? d.tempos)[i]}` : '')).filter(Boolean).join(' · ')}</span>}
        </div>
        {aulas.length === 0 && <>
        <p className="muted small">Sem hora: só os tempos por dia.</p>
        <div className="week">
          {DIAS_SEMANA.slice(0, 5).map((dia, i) => (
            <label key={dia}>
              {dia}
              <input
                type="number" min={0} max={12} inputMode="numeric"
                value={(doHorario ?? d.tempos)[i] || ''} placeholder="0"
                disabled={!!doHorario}
                onChange={(e) => {
                  const t = [...d.tempos];
                  t[i] = Math.max(0, Math.min(12, Number(e.target.value) || 0));
                  set('tempos', t);
                }}
              />
            </label>
          ))}
        </div>
        </>}
        {!ehGeral(d) && (
          <label className="minutos-tempo">Cada tempo conta
            <select value={mpt} onChange={(e) => {
              const v = Number(e.target.value);
              set('minutosPorTempo', v === estado.calendario.minutosPorTempo ? undefined : v);
            }}>
              {[...new Set([45, 50, 60, 90, estado.calendario.minutosPorTempo, mpt])].sort((a, b) => a - b).map((n) => (
                <option key={n} value={n}>{n} min</option>
              ))}
            </select>
            <small className="muted">25 h = {temposDoModulo({ quantidade: 25, unidade: 'h' }, mpt)} tempos</small>
          </label>
        )}
      </fieldset>

      <div className="grid-form">
        {/* Sem valor próprio, mostram as datas do calendário para o ano e o ensino; só ficam fixas se forem alteradas. */}
        <label>Começa em
          <input type="date" value={d.inicio ?? doCalendario.inicio} onChange={(e) => set('inicio', e.target.value && e.target.value !== doCalendario.inicio ? e.target.value : undefined)} />
          <small className="muted">{d.inicio ? <button type="button" className="link-btn small" onClick={() => set('inicio', undefined)}>Repor do calendário</button> : 'Do calendário'}</small>
        </label>
        <label>Acaba em
          <input type="date" value={d.fim ?? doCalendario.fim} onChange={(e) => set('fim', e.target.value && e.target.value !== doCalendario.fim ? e.target.value : undefined)} />
          <small className="muted">{d.fim ? <button type="button" className="link-btn small" onClick={() => set('fim', undefined)}>Repor do calendário</button> : 'Do calendário'}</small>
        </label>
      </div>

      <fieldset>
        <legend>Dias sem aula desta disciplina</legend>
        <p className="muted small">Visitas de estudo, reuniões, provas, ... Greve, doença, consulta: em Sem aulas.</p>
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

      {geral && plano && (
        <p className="small muted">
          Disciplina anual: {plano.temposDisponiveis} tempos ({plano.dias.length} dias de aula), de {fmtLong(plano.inicio)} a {fmtLong(plano.fim)}.
        </p>
      )}
      {!geral && <fieldset>
        <legend>UC e módulos, por ordem</legend>
        <div className="mod-list">
          {d.modulos.map((m, i) => {
            const pm = plano?.modulos.find((x) => x.modulo.id === m.id);
            return (
              <div key={m.id} className="mod-edit">
                <span className="mod-n">{i + 1}</span>
                <input className="mod-code" placeholder="Código" defaultValue={m.codigo ?? ''} key={m.codigo ?? 'x'}
                  onBlur={(e) => e.target.value !== (m.codigo ?? '') && mudarCodigo(m, e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  aria-label="Código da UC" />
                <input className="mod-nome" placeholder="Nome do módulo" value={m.nome} onChange={(e) => mudarModulo(m.id, (x) => ({ ...x, nome: e.target.value }))} onBlur={() => registar(m)} aria-label="Nome" />
                <input className="mod-qt" type="number" min={1} value={m.quantidade || ''} onChange={(e) => mudarModulo(m.id, (x) => ({ ...x, quantidade: Number(e.target.value) }))} onBlur={() => registar(m)} aria-label="Duração" />
                <select value={m.unidade} onChange={(e) => mudarModulo(m.id, (x) => ({ ...x, unidade: e.target.value as 'h' | 't' }))} aria-label="Unidade">
                  <option value="h">horas</option>
                  <option value="t">tempos</option>
                </select>
                <span className="mod-info">
                  {m.unidade === 'h' && `${temposDoModulo(m, mpt)} tempos`}
                  {pm?.inicio && ` · ${fmtLong(pm.inicio)} a ${fmtLong(pm.fim!)}`}
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
                const achado = procurarCodigo(estado.catalogo, procura);
                if (e.key === 'Enter' && achado) {
                  addModulo(achado);
                  setProcura('');
                }
              }} />
            {resultados.length > 0 && (
              <ul className="results">
                {resultados.map((r) => (
                  <li key={r.codigo}>
                    <button onClick={() => { addModulo(r); setProcura(''); }}>
                      {codigoVisivel(r) && <strong>{codigoVisivel(r)} </strong>}{r.nome} <small>{r.horas} h{r.opcional ? ' · opcional' : ''}</small>
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
      </fieldset>}

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

/** Horas do horário que não são aulas (Equipa TIC, apoio, reuniões): o nome é livre. */
function OutrasAtividades({ estado, atualizar }: { estado: Estado; atualizar: Props['atualizar'] }) {
  const lista = atividadesDe(estado);
  const gravar = (nova: Atividade[]) => atualizar((e) => ({ ...e, atividades: nova }));
  const mudar = (id: string, m: Partial<Atividade>) => gravar(lista.map((a) => (a.id === id ? { ...a, ...m } : a)));
  const nova = () => {
    const ult = lista[lista.length - 1];
    gravar([...lista, ult
      ? { id: uid(), nome: '', dia: (ult.dia + 1) % 5, inicio: ult.inicio, fim: ult.fim }
      : { id: uid(), nome: '', dia: 0, inicio: '08:15', fim: somarMinutos('08:15', estado.calendario.minutosPorTempo) }]);
  };
  return (
    <section className="card plain">
      <h2>Outras atividades</h2>
      <p className="muted small">Horas no horário que não são aulas: Equipa TIC, apoio, reuniões.</p>
      {lista.map((a) => (
        <div key={a.id} className="atividade-linha">
          <input value={a.nome} placeholder="Equipa TIC" onChange={(e) => mudar(a.id, { nome: e.target.value })} aria-label="Nome" />
          <select value={a.dia} onChange={(e) => mudar(a.id, { dia: Number(e.target.value) })} aria-label="Dia">
            {DIAS_SEMANA.slice(0, 6).map((n, i) => <option key={n} value={i}>{n}</option>)}
          </select>
          <input type="time" step={300} value={a.inicio} onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            // A duração mantém-se ao mudar o início.
            const dur = Math.max(5, toMin(a.fim) - toMin(a.inicio));
            mudar(a.id, { inicio: v, fim: somarMinutos(v, dur) });
          }} aria-label="Início" />
          <input type="time" step={300} value={a.fim} onChange={(e) => e.target.value && mudar(a.id, { fim: e.target.value })} aria-label="Fim" />
          <input value={a.sala ?? ''} placeholder="Sala" onChange={(e) => mudar(a.id, { sala: e.target.value || undefined })} aria-label="Sala" />
          <button className="icon-btn" onClick={() => gravar(lista.filter((x) => x.id !== a.id))} aria-label="Apagar atividade"><IconTrash /></button>
        </div>
      ))}
      <button className="btn" onClick={nova}>+ Atividade</button>
    </section>
  );
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

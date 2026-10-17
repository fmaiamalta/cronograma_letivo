import { useEffect, useMemo, useState } from 'react';
import { CalendarioView } from './components/CalendarioView';
import { CatalogoView } from './components/CatalogoView';
import { Gantt } from './components/Gantt';
import { HorarioView } from './components/HorarioView';
import { IconBook, IconCalendar, IconCheck, IconClock, IconTimeline } from './components/icons';
import { ModuloPanel } from './components/ModuloPanel';
import { TarefasView } from './components/TarefasView';
import { todayISO } from './lib/dates';
import { planear } from './lib/engine';
import { exemplo } from './lib/presets';
import { calendarioDoLink, useEstado, validarEstado } from './lib/store';
import type { CalendarioEscolar, Modulo } from './lib/types';

type Separador = 'cronograma' | 'horario' | 'calendario' | 'catalogo' | 'tarefas';

const SEPARADORES: { id: Separador; nome: string; Icone: () => JSX.Element }[] = [
  { id: 'cronograma', nome: 'Cronograma', Icone: IconTimeline },
  { id: 'horario', nome: 'Horário', Icone: IconClock },
  { id: 'tarefas', nome: 'Tarefas', Icone: IconCheck },
  { id: 'calendario', nome: 'Calendário', Icone: IconCalendar },
  { id: 'catalogo', nome: 'Catálogo', Icone: IconBook },
];

function lerPreferencia<T>(chave: string, padrao: T): T {
  try {
    const v = localStorage.getItem(chave);
    return v ? (JSON.parse(v) as T) : padrao;
  } catch {
    return padrao;
  }
}

function gravarPreferencia(chave: string, v: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify(v));
  } catch {
    // Sem armazenamento: a preferência dura só esta sessão.
  }
}

export default function App() {
  const { estado, atualizar, setEstado, gravado } = useEstado();
  const [sep, setSep] = useState<Separador>(() => (estado.disciplinas.length ? 'cronograma' : 'horario'));
  const [pxDia, setPxDia] = useState<number>(() => lerPreferencia('cronograma.zoom', 3));
  const [filtroTurma, setFiltroTurma] = useState<string>('');
  const [aberto, setAberto] = useState<{ d: string; m: string } | null>(null);
  const [editar, setEditar] = useState<string | null>(null);
  const [calRecebido, setCalRecebido] = useState<CalendarioEscolar | null>(() => calendarioDoLink(location.hash));
  const [hoje, setHoje] = useState(todayISO());

  // A linha do dia atual avança sozinha se a app ficar aberta de um dia para o outro.
  useEffect(() => {
    const t = setInterval(() => setHoje(todayISO()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => gravarPreferencia('cronograma.zoom', pxDia), [pxDia]);

  const planos = useMemo(
    () => estado.disciplinas.map((d) => planear(d, estado.calendario, estado.periodosTurma, hoje)),
    [estado.disciplinas, estado.calendario, estado.periodosTurma, hoje],
  );
  const turmas = [...new Set(estado.disciplinas.map((d) => d.turma))].sort();
  const visiveis = filtroTurma ? planos.filter((p) => p.disciplina.turma === filtroTurma) : planos;

  const mudarModulo = (dId: string, mId: string, f: (m: Modulo) => Modulo) =>
    atualizar((e) => ({
      ...e,
      disciplinas: e.disciplinas.map((d) => (d.id === dId ? { ...d, modulos: d.modulos.map((m) => (m.id === mId ? f(m) : m)) } : d)),
    }));

  const alternarTarefa = (dId: string, mId: string, tId: string) =>
    mudarModulo(dId, mId, (m) => ({ ...m, tarefas: m.tarefas.map((t) => (t.id === tId ? { ...t, feita: !t.feita } : t)) }));

  const carregarExemplo = () => {
    atualizar((e) => ({ ...e, ...exemplo() }));
    setSep('cronograma');
  };

  const exportar = () => {
    const blob = new Blob([JSON.stringify(estado, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cronograma-${estado.calendario.anoLetivo.replace('/', '-')}-${todayISO()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const importarCopia = async (file: File) => {
    try {
      const e = validarEstado(JSON.parse(await file.text()));
      if (!e) throw new Error('formato desconhecido');
      if (confirm('Substituir todos os dados pelos do ficheiro?')) setEstado(e);
    } catch (err) {
      alert(`Ficheiro inválido: ${(err as Error).message}`);
    }
  };

  const aceitarCalendario = () => {
    if (calRecebido) atualizar((e) => ({ ...e, calendario: calRecebido }));
    fecharBanner();
  };
  const fecharBanner = () => {
    setCalRecebido(null);
    history.replaceState(null, '', location.pathname + location.search);
  };

  const planoAberto = aberto && planos.find((p) => p.disciplina.id === aberto.d);
  const pmAberto = planoAberto && planoAberto.modulos.find((m) => m.modulo.id === aberto!.m);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <div>
            <strong>Cronograma Letivo</strong>
            <small>{estado.calendario.escola || 'Cursos profissionais'} · {estado.calendario.anoLetivo}</small>
          </div>
        </div>
        <nav className="tabs" aria-label="Secções">
          {SEPARADORES.map(({ id, nome, Icone }) => (
            <button key={id} className={sep === id ? 'active' : ''} onClick={() => setSep(id)} aria-current={sep === id ? 'page' : undefined}>
              <Icone /> <span>{nome}</span>
            </button>
          ))}
        </nav>
        <details className="menu">
          <summary aria-label="Mais opções">⋯</summary>
          <div className="menu-pop">
            <button onClick={exportar}>Exportar cópia (.json)</button>
            <label>
              Importar cópia
              <input type="file" hidden accept=".json,application/json" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importarCopia(f); }} />
            </label>
            <button onClick={() => { setSep('cronograma'); setTimeout(() => window.print(), 100); }}>Imprimir ou guardar PDF</button>
          </div>
        </details>
      </header>

      {!gravado && <div className="banner warn-bg">Os dados não estão a ser guardados neste browser (janela privada?). Convém exportar uma cópia.</div>}

      {calRecebido && (
        <div className="banner">
          <span>Calendário escolar {calRecebido.anoLetivo}{calRecebido.escola ? ` (${calRecebido.escola})` : ''} recebido por link.</span>
          <div className="row">
            <button className="btn primary" onClick={aceitarCalendario}>Usar este calendário</button>
            <button className="btn" onClick={fecharBanner}>Ignorar</button>
          </div>
        </div>
      )}

      <main>
        {sep === 'cronograma' && (
          <div className="page wide">
            <div className="page-head">
              <div>
                <h1>Cronograma {estado.calendario.anoLetivo}</h1>
                <p className="muted print-hide">Interrupções a cinzento. Linha vermelha: hoje.</p>
              </div>
              {planos.length > 0 && (
                <div className="row wrap print-hide">
                  <select value={filtroTurma} onChange={(e) => setFiltroTurma(e.target.value)} aria-label="Filtrar por turma">
                    <option value="">Todas as turmas</option>
                    {turmas.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <div className="zoom" role="group" aria-label="Zoom">
                    <button className="icon-btn" onClick={() => setPxDia((z) => Math.max(1.5, z - 1))} aria-label="Afastar">−</button>
                    <button className="icon-btn" onClick={() => setPxDia((z) => Math.min(12, z + 1))} aria-label="Aproximar">+</button>
                  </div>
                </div>
              )}
            </div>
            {!estado.calendario.importadoDe && planos.length > 0 && (
              <div className="banner print-hide" style={{ margin: '0 0 12px' }}>
                <span>Calendário nacional em uso. Falta importar o calendário da escola.</span>
                <button className="btn" onClick={() => setSep('calendario')}>Importar calendário</button>
              </div>
            )}
            {planos.length === 0 ? (
              <div className="empty">
                <p>Sem disciplinas no horário.</p>
                <div className="row">
                  <button className="btn primary" onClick={() => setSep('horario')}>Preencher o horário</button>
                  <button className="btn" onClick={carregarExemplo}>Ver um exemplo</button>
                </div>
              </div>
            ) : (
              <Gantt
                calendario={estado.calendario}
                planos={visiveis}
                periodosTurma={estado.periodosTurma}
                hoje={hoje}
                pxDia={pxDia}
                onAbrir={(d, m) => setAberto({ d, m })}
              />
            )}
            <p className="legend">
              {estado.calendario.interrupcoes.map((i) => `${i.nome} ${i.inicio.slice(8, 10)}/${i.inicio.slice(5, 7)}–${i.fim.slice(8, 10)}/${i.fim.slice(5, 7)}`).join(' | ')}
              . Linhas finas: feriados.
            </p>
          </div>
        )}
        {sep === 'horario' && (
          <HorarioView estado={estado} planos={planos} aberta={editar} setAberta={setEditar} atualizar={atualizar} onExemplo={carregarExemplo} />
        )}
        {sep === 'calendario' && <CalendarioView estado={estado} atualizar={atualizar} />}
        {sep === 'catalogo' && <CatalogoView estado={estado} atualizar={atualizar} />}
        {sep === 'tarefas' && <TarefasView estado={estado} hoje={hoje} onAlternar={alternarTarefa} onAbrir={(d, m) => setAberto({ d, m })} />}
      </main>

      {planoAberto && pmAberto && (
        <ModuloPanel
          key={pmAberto.modulo.id}
          plano={planoAberto}
          pm={pmAberto}
          hoje={hoje}
          onMudar={(f) => mudarModulo(aberto!.d, aberto!.m, f)}
          onFechar={() => setAberto(null)}
          onEditar={() => { setEditar(aberto!.d); setAberto(null); setSep('horario'); }}
        />
      )}
    </div>
  );
}

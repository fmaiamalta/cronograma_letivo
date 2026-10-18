import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarioView } from './components/CalendarioView';
import { CatalogoView } from './components/CatalogoView';
import { Gantt } from './components/Gantt';
import { GanttCompacto } from './components/GanttCompacto';
import { HorarioView } from './components/HorarioView';
import { IconBook, IconCalendar, IconCheck, IconClock, IconTimeline } from './components/icons';
import { HorarioLeitura } from './components/HorarioLeitura';
import { ModuloPanel } from './components/ModuloPanel';
import { SyncDialog } from './components/SyncDialog';
import { TarefaForm, type DestinoTarefa } from './components/TarefaForm';
import { EnviarDialog, ReceberDialog } from './components/TransferDialog';
import { TarefasView } from './components/TarefasView';
import { todayISO } from './lib/dates';
import { planear } from './lib/engine';
import { exemplo } from './lib/presets';
import { calendarioDoLink, useEstado, validarEstado } from './lib/store';
import { gistDoTexto, gravarSync, lerSync, obter, publicar, type ConfigSync } from './lib/sync';
import { aplicarPacote, codificar, descodificar } from './lib/transfer';
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

// Telemóvel (ao alto ou deitado): só consulta. Tablets e computadores editam.
const CONSULTA = '(max-width: 760px), (pointer: coarse) and (max-height: 500px)';

function useTelemovel(): boolean {
  const [v, setV] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(CONSULTA).matches);
  useEffect(() => {
    const m = matchMedia(CONSULTA);
    const f = () => setV(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  return v;
}

export default function App() {
  const telemovel = useTelemovel();
  const [transfer, setTransfer] = useState<'enviar' | 'receber' | 'sync' | null>(() => (location.hash.includes('dados=') ? 'receber' : null));
  const [dadosLink] = useState(() => (location.hash.includes('dados=') ? location.hash : ''));
  const { estado, atualizar, setEstado, gravado } = useEstado();
  const [sep, setSep] = useState<Separador>(() =>
    estado.disciplinas.length || (typeof matchMedia !== 'undefined' && matchMedia(CONSULTA).matches) ? 'cronograma' : 'horario',
  );
  const [pxDia, setPxDia] = useState<number>(() => lerPreferencia('cronograma.zoom', 3));
  // Telemóvel: 1 = ano inteiro no ecrã.
  const [zoomTel, setZoomTel] = useState<number>(() => lerPreferencia('cronograma.zoomTel', 1));
  const [filtroTurma, setFiltroTurma] = useState<string>('');
  const [aberto, setAberto] = useState<{ d: string; m: string } | null>(null);
  const [editar, setEditar] = useState<string | null>(null);
  const [formTarefa, setFormTarefa] = useState<{ inicial?: DestinoTarefa } | null>(null);
  const [calRecebido, setCalRecebido] = useState<CalendarioEscolar | null>(() => calendarioDoLink(location.hash));
  const [hoje, setHoje] = useState(todayISO());

  // A linha do dia atual avança sozinha se a app ficar aberta de um dia para o outro.
  useEffect(() => {
    const t = setInterval(() => setHoje(todayISO()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => gravarPreferencia('cronograma.zoom', pxDia), [pxDia]);
  useEffect(() => gravarPreferencia('cronograma.zoomTel', zoomTel), [zoomTel]);

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

  /** Grava uma tarefa nova ou editada; se mudou de módulo, sai do antigo. */
  const gravarTarefa = (antes: DestinoTarefa | undefined, depois: DestinoTarefa) => {
    atualizar((e) => ({
      ...e,
      disciplinas: e.disciplinas.map((d) => ({
        ...d,
        modulos: d.modulos.map((m) => {
          let tarefas = m.tarefas;
          if (antes && d.id === antes.dId && m.id === antes.mId) tarefas = tarefas.filter((t) => t.id !== antes.tarefa.id);
          if (d.id === depois.dId && m.id === depois.mId) {
            // No mesmo módulo fica no mesmo lugar; num módulo novo entra no fim.
            tarefas = m.tarefas.some((t) => t.id === depois.tarefa.id)
              ? m.tarefas.map((t) => (t.id === depois.tarefa.id ? depois.tarefa : t))
              : [...tarefas, depois.tarefa];
          }
          return tarefas === m.tarefas ? m : { ...m, tarefas };
        }),
      })),
    }));
    setFormTarefa(null);
  };

  const apagarTarefa = (alvo: DestinoTarefa) => {
    mudarModulo(alvo.dId, alvo.mId, (m) => ({ ...m, tarefas: m.tarefas.filter((t) => t.id !== alvo.tarefa.id) }));
    setFormTarefa(null);
  };

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

  // ---- Sincronização automática (computador → telemóvel) ----
  const [sync, setSyncState] = useState<ConfigSync>(() => {
    // Link "#sync=..." aberto diretamente (Android): fica ligado a esse Gist.
    const g = gistDoTexto(location.hash);
    return g ? gravarSync({ ...lerSync(), gistId: g, token: undefined, etag: undefined }) : lerSync();
  });
  const setSync = useCallback((f: (s: ConfigSync) => ConfigSync) => setSyncState((s) => gravarSync(f(s))), []);
  const estadoRef = useRef(estado);
  estadoRef.current = estado;
  const syncRef = useRef(sync);
  syncRef.current = sync;
  const ultimoEnviado = useRef('');

  useEffect(() => {
    if (gistDoTexto(location.hash)) history.replaceState(null, '', location.pathname + location.search);
  }, []);

  const enviarAgora = useCallback(
    async (token?: string) => {
      const s = syncRef.current;
      const tk = token ?? s.token;
      if (!tk) return;
      const codigo = await codificar(estadoRef.current);
      try {
        const id = await publicar(tk, s.gistId, codigo);
        ultimoEnviado.current = codigo;
        setSync((x) => ({ ...x, token: tk, gistId: id, ultimo: new Date().toISOString(), erro: undefined }));
      } catch (err) {
        setSync((x) => ({ ...x, erro: (err as Error).message }));
        throw err;
      }
    },
    [setSync],
  );

  // Computador: envia 3 s depois da última alteração.
  useEffect(() => {
    if (!sync.token || !sync.gistId) return;
    const t = setTimeout(async () => {
      if ((await codificar(estadoRef.current)) === ultimoEnviado.current) return;
      enviarAgora().catch(() => undefined);
    }, 3000);
    return () => clearTimeout(t);
  }, [estado, sync.token, sync.gistId, enviarAgora]);

  // Telemóvel: vai buscar ao abrir, ao voltar à app e de 5 em 5 minutos.
  const puxar = useCallback(async () => {
    const s = syncRef.current;
    if (s.token || !s.gistId) return;
    try {
      const r = await obter(s.gistId, s.etag);
      if (r.naoMudou || !r.codigo) {
        setSync((x) => ({ ...x, ultimo: new Date().toISOString(), erro: undefined }));
        return;
      }
      const p = await descodificar(r.codigo);
      if (!p) throw new Error('Dados recebidos inválidos.');
      atualizar((e) => aplicarPacote(e, p));
      setSync((x) => ({ ...x, etag: r.etag, ultimo: new Date().toISOString(), erro: undefined }));
    } catch (err) {
      setSync((x) => ({ ...x, erro: (err as Error).message }));
    }
  }, [atualizar, setSync]);

  useEffect(() => {
    if (sync.token || !sync.gistId) return;
    puxar();
    const aoVoltar = () => document.visibilityState === 'visible' && puxar();
    document.addEventListener('visibilitychange', aoVoltar);
    const t = setInterval(puxar, 5 * 60_000);
    return () => {
      document.removeEventListener('visibilitychange', aoVoltar);
      clearInterval(t);
    };
  }, [sync.token, sync.gistId, puxar]);

  const separadores = telemovel ? SEPARADORES.filter((x) => x.id === 'cronograma' || x.id === 'horario' || x.id === 'tarefas') : SEPARADORES;
  // No telemóvel não há Calendário nem Catálogo: mostra o cronograma.
  const atual: Separador = telemovel && (sep === 'calendario' || sep === 'catalogo') ? 'cronograma' : sep;

  const fecharTransfer = () => {
    setTransfer(null);
    if (location.hash.includes('dados=')) history.replaceState(null, '', location.pathname + location.search);
  };

  const fecharMenu = (e: React.MouseEvent) => (e.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open');

  const planoAberto = aberto && planos.find((p) => p.disciplina.id === aberto.d);
  const pmAberto = planoAberto && planoAberto.modulos.find((m) => m.modulo.id === aberto!.m);

  return (
    <div className={'app' + (telemovel ? ' telemovel' : '')}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <div>
            <strong>Cronograma Letivo</strong>
            <small>{estado.calendario.escola || 'Cursos profissionais'} · {estado.calendario.anoLetivo}</small>
          </div>
        </div>
        <nav className="tabs" aria-label="Secções">
          {separadores.map(({ id, nome, Icone }) => (
            <button key={id} className={atual === id ? 'active' : ''} onClick={() => setSep(id)} aria-current={atual === id ? 'page' : undefined}>
              <Icone /> <span>{nome}</span>
            </button>
          ))}
        </nav>
        <details className="menu">
          <summary aria-label="Mais opções">⋯</summary>
          <div className="menu-pop" onClick={fecharMenu}>
            {telemovel ? (
              <>
                <button onClick={() => setTransfer('receber')}>Receber do computador</button>
                {sync.gistId && !sync.token && <button onClick={() => puxar()}>Atualizar agora</button>}
              </>
            ) : (
              <>
                <button onClick={() => setTransfer('sync')}>Sincronizar com o telemóvel</button>
                <button onClick={() => setTransfer('enviar')}>Enviar link (manual)</button>
              </>
            )}
            <button onClick={exportar}>Exportar cópia (.json)</button>
            <label>
              Importar cópia
              <input type="file" hidden accept=".json,application/json" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importarCopia(f); }} />
            </label>
            {!telemovel && <button onClick={() => { setSep('cronograma'); setTimeout(() => window.print(), 100); }}>Imprimir ou guardar PDF</button>}
          </div>
        </details>
      </header>

      {telemovel && sync.erro && !sync.token && <div className="banner warn-bg">Sincronização: {sync.erro}</div>}
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
        {atual === 'cronograma' && (
          <div className={'page wide' + (telemovel ? ' gc-page' : '')}>
            {telemovel && planos.length > 0 && (
              <div className="gc-controls">
                <select value={filtroTurma} onChange={(e) => setFiltroTurma(e.target.value)} aria-label="Filtrar por turma">
                  <option value="">Todas as turmas</option>
                  {turmas.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <div className="zoom" role="group" aria-label="Zoom">
                  <button className="icon-btn" onClick={() => setZoomTel((z) => Math.max(1, z / 2))} disabled={zoomTel <= 1} aria-label="Afastar">−</button>
                  <button className="icon-btn" onClick={() => setZoomTel((z) => Math.min(8, z * 2))} disabled={zoomTel >= 8} aria-label="Aproximar">+</button>
                  <button className="icon-btn" onClick={() => setZoomTel(1)} disabled={zoomTel === 1} aria-label="Ano inteiro">↔</button>
                </div>
              </div>
            )}
            <div className="page-head">
              <div>
                <h1>Cronograma {estado.calendario.anoLetivo}</h1>
                <p className="muted print-hide ajuda">Interrupções a cinzento. Linha vermelha: hoje.</p>
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
              <div className="banner print-hide ajuda" style={{ margin: '0 0 12px' }}>
                <span>Calendário nacional em uso. Falta importar o calendário da escola.</span>
                <button className="btn" onClick={() => setSep('calendario')}>Importar calendário</button>
              </div>
            )}
            {planos.length === 0 ? (
              telemovel ? (
                <div className="empty">
                  <p>Sem dados.</p>
                  <div className="row">
                    <button className="btn primary" onClick={() => setTransfer('receber')}>Receber do computador</button>
                  </div>
                </div>
              ) : <div className="empty">
                <p>Sem disciplinas no horário.</p>
                <div className="row">
                  <button className="btn primary" onClick={() => setSep('horario')}>Preencher o horário</button>
                  <button className="btn" onClick={carregarExemplo}>Ver um exemplo</button>
                </div>
              </div>
            ) : (
              telemovel ? (
                <GanttCompacto
                  calendario={estado.calendario}
                  planos={visiveis}
                  periodosTurma={estado.periodosTurma}
                  hoje={hoje}
                  zoom={zoomTel}
                  onAbrir={(d, m) => setAberto({ d, m })}
                />
              ) : <Gantt
                calendario={estado.calendario}
                planos={visiveis}
                periodosTurma={estado.periodosTurma}
                hoje={hoje}
                pxDia={pxDia}
                onAbrir={(d, m) => setAberto({ d, m })}
              />
            )}
            <p className="legend ajuda">
              {estado.calendario.interrupcoes.map((i) => `${i.nome} ${i.inicio.slice(8, 10)}/${i.inicio.slice(5, 7)}–${i.fim.slice(8, 10)}/${i.fim.slice(5, 7)}`).join(' | ')}
              . Linhas finas: feriados.
            </p>
          </div>
        )}
        {atual === 'horario' && (
          telemovel ? (
            <HorarioLeitura planos={planos} onAbrir={(d, m) => setAberto({ d, m })} />
          ) : (
            <HorarioView estado={estado} planos={planos} aberta={editar} setAberta={setEditar} atualizar={atualizar} onExemplo={carregarExemplo} />
          )
        )}
        {atual === 'calendario' && <CalendarioView estado={estado} atualizar={atualizar} />}
        {atual === 'catalogo' && <CatalogoView estado={estado} atualizar={atualizar} />}
        {atual === 'tarefas' && <TarefasView
            estado={estado}
            hoje={hoje}
            soLeitura={telemovel}
            onAlternar={alternarTarefa}
            onAbrir={(d, m) => setAberto({ d, m })}
            onNova={() => setFormTarefa({})}
            onEditar={(dId, mId, tarefa) => setFormTarefa({ inicial: { dId, mId, tarefa } })}
          />}
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
          soLeitura={telemovel}
        />
      )}

      {formTarefa && !telemovel && (
        <TarefaForm
          estado={estado}
          inicial={formTarefa.inicial}
          onGravar={gravarTarefa}
          onApagar={formTarefa.inicial ? () => apagarTarefa(formTarefa.inicial!) : undefined}
          onFechar={() => setFormTarefa(null)}
        />
      )}
      {transfer === 'enviar' && <EnviarDialog estado={estado} onFechar={fecharTransfer} />}
      {transfer === 'sync' && (
        <SyncDialog
          sync={sync}
          onLigar={(token) => enviarAgora(token)}
          onDesligar={() => setSync((x) => ({ ...x, token: undefined, erro: undefined }))}
          onFechar={fecharTransfer}
        />
      )}
      {transfer === 'receber' && (
        <ReceberDialog
          inicial={dadosLink}
          onFechar={fecharTransfer}
          onLigarSync={(gistId) => {
            setSync((x) => ({ ...x, gistId, token: undefined, etag: undefined, erro: undefined }));
            fecharTransfer();
            setSep('cronograma');
          }}
          onAplicar={(p) => {
            atualizar((e) => aplicarPacote(e, p));
            fecharTransfer();
            setSep('cronograma');
          }}
        />
      )}
    </div>
  );
}

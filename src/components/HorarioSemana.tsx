import { useMemo, useState } from 'react';
import { addDays, DIAS_SEMANA, weekday } from '../lib/dates';
import { motivoSemAula, type PlanoDisciplina } from '../lib/engine';
import { aplicarHorario, aulasSemDisciplina, disciplinaDoBloco, ehAula, lerHorarioICS, minutos, nomeTurmas, sigla, temposDoHorario } from '../lib/horario';
import type { Bloco, Estado, ISODate } from '../lib/types';
import { Ausencias } from './Ausencias';

interface Props {
  estado: Estado;
  planos: PlanoDisciplina[];
  hoje: ISODate;
  telemovel: boolean;
  atualizar: (f: (e: Estado) => Estado) => void;
  onAbrir: (disciplinaId: string, moduloId: string) => void;
}

interface Pendente {
  blocos: Bloco[];
  origem: string;
  semDisciplina: { titulo: string; turmas: string[] }[];
  criar: Set<number>;
}

const MESES_EXTENSO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Segunda-feira da semana a mostrar; ao fim de semana, a seguinte. */
function segundaDe(iso: ISODate): ISODate {
  const d = weekday(iso);
  return d >= 5 ? addDays(iso, 7 - d) : addDays(iso, -d);
}

function intervaloSemana(seg: ISODate, dias: number): string {
  const fim = addDays(seg, dias - 1);
  const [, m1, d1] = seg.split('-').map(Number);
  const [, m2, d2] = fim.split('-').map(Number);
  const mes = (m: number) => MESES_EXTENSO[m - 1];
  return m1 === m2 ? `${d1} a ${d2} de ${mes(m1)}` : `${d1} de ${mes(m1)} a ${d2} de ${mes(m2)}`;
}

function horasDiasTexto(t: number[]): string {
  return t.map((n, i) => (n ? `${DIAS_SEMANA[i]} ${n}` : '')).filter(Boolean).join(' · ');
}

export function HorarioSemana({ estado, planos, hoje, telemovel, atualizar, onAbrir }: Props) {
  const blocos = estado.horario?.blocos ?? [];
  const [segunda, setSegunda] = useState(() => segundaDe(hoje));
  const [pendente, setPendente] = useState<Pendente | null>(null);
  const [erro, setErro] = useState('');

  const importar = async (f: File) => {
    setErro('');
    const lidos = lerHorarioICS(await f.text());
    if (!lidos.length) {
      setErro('Sem aulas reconhecidas neste ficheiro.');
      return;
    }
    const semDisciplina = aulasSemDisciplina(lidos, estado.disciplinas);
    setPendente({ blocos: lidos, origem: f.name, semDisciplina, criar: new Set(semDisciplina.map((_, i) => i)) });
  };

  const aplicar = () => {
    if (!pendente) return;
    const criar = pendente.semDisciplina.filter((_, i) => pendente.criar.has(i));
    atualizar((e) => aplicarHorario(e, pendente.blocos, pendente.origem, hoje, criar));
    setPendente(null);
  };

  const dias = blocos.some((b) => b.dia === 5) ? 6 : 5;
  const datas = Array.from({ length: dias }, (_, i) => addDays(segunda, i));
  const inicioMin = blocos.length ? Math.floor(Math.min(...blocos.map((b) => minutos(b.inicio))) / 60) * 60 : 8 * 60;
  const fimMin = blocos.length ? Math.ceil(Math.max(...blocos.map((b) => minutos(b.fim))) / 60) * 60 : 18 * 60;
  const pxMin = telemovel ? 0.95 : 1.15;
  const altura = (fimMin - inicioMin) * pxMin;
  const horas = Array.from({ length: (fimMin - inicioMin) / 60 + 1 }, (_, i) => inicioMin + i * 60);

  // Disciplina de cada bloco e o módulo dado em cada dia.
  const ligacao = useMemo(() => new Map(blocos.map((b) => [b.id, disciplinaDoBloco(b, estado.disciplinas, blocos)])), [blocos, estado.disciplinas]);
  const moduloNoDia = (dId: string, data: ISODate) => {
    const p = planos.find((x) => x.disciplina.id === dId);
    const pm = p?.modulos.find((m) => m.sessoes.some((s) => s.data === data));
    return pm?.modulo;
  };

  const agora = new Date();
  const minAgora = agora.getHours() * 60 + agora.getMinutes();

  const importarBotao = (
    <label className={'btn' + (blocos.length ? '' : ' primary')}>
      {blocos.length ? 'Importar outra vez' : 'Importar horário (.ics)'}
      <input type="file" accept=".ics,text/calendar" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); e.target.value = ''; }} />
    </label>
  );

  const setas = (
    <div className="zoom" role="group" aria-label="Semana">
      <button className="icon-btn" onClick={() => setSegunda((s) => addDays(s, -7))} aria-label="Semana anterior">‹</button>
      <button className="icon-btn semana-hoje" onClick={() => setSegunda(segundaDe(hoje))} disabled={segunda === segundaDe(hoje)}>Hoje</button>
      <button className="icon-btn" onClick={() => setSegunda((s) => addDays(s, 7))} aria-label="Semana seguinte">›</button>
    </div>
  );
  // No telemóvel, as datas e as setas numa só linha, no lugar do título.
  const navegacao = (
    <div className="semana-nav">
      <strong>{intervaloSemana(segunda, dias)}</strong>
      {setas}
    </div>
  );

  return (
    <div className={'page semana-page' + (telemovel && blocos.length ? ' com-nav' : '')}>
      {telemovel && blocos.length > 0 && navegacao}
      <div className="page-head">
        <div>
          <h1>Horário</h1>
          <p className="muted">{blocos.length ? `${intervaloSemana(segunda, dias)}` : 'Grelha semanal da escola, em ficheiro .ics (ex.: inforarios.pt).'}</p>
        </div>
        <div className="row wrap">
          {!telemovel && blocos.length > 0 && setas}
          {!telemovel && importarBotao}
        </div>
      </div>

      {erro && <p className="warn">{erro}</p>}

      {pendente && (
        <section className="card plain importar-horario">
          <h2>{pendente.origem}</h2>
          <p className="small muted">
            {pendente.blocos.filter(ehAula).length} aulas e {pendente.blocos.filter((b) => !ehAula(b)).length} outras atividades por semana. Os tempos por dia passam a vir do horário.
          </p>
          <ul className="importar-lista">
            {[...temposDoHorario(pendente.blocos, estado.disciplinas, estado.calendario.minutosPorTempo)].map(([id, t]) => {
              const d = estado.disciplinas.find((x) => x.id === id)!;
              return <li key={id}><strong>{d.turma} | {d.nome || '—'}</strong> <span className="muted">{horasDiasTexto(t)}</span></li>;
            })}
          </ul>
          {pendente.semDisciplina.length > 0 && (
            <>
              <p className="small">Sem disciplina no cronograma:</p>
              <ul className="importar-lista">
                {pendente.semDisciplina.map((a, i) => (
                  <li key={i}>
                    <label className="check-linha">
                      <input type="checkbox" checked={pendente.criar.has(i)} onChange={() => setPendente((p) => {
                        if (!p) return p;
                        const c = new Set(p.criar);
                        if (c.has(i)) c.delete(i); else c.add(i);
                        return { ...p, criar: c };
                      })} />
                      Criar <strong>{nomeTurmas(a.turmas)} | {a.titulo}</strong>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="row end">
            <button className="btn" onClick={() => setPendente(null)}>Cancelar</button>
            <button className="btn primary" onClick={aplicar}>Aplicar</button>
          </div>
        </section>
      )}

      {!blocos.length && !pendente && (
        <div className="empty">
          <p>Sem horário.</p>
          <div className="row">{importarBotao}</div>
        </div>
      )}

      {blocos.length > 0 && (
        <div className="semana" style={{ ['--dias' as string]: dias }}>
          <div className="semana-cab">
            <span />
            {datas.map((d) => (
              <span key={d} className={'semana-dia' + (d === hoje ? ' hoje' : '')}>
                <small>{DIAS_SEMANA[weekday(d)]}</small>
                <strong>{Number(d.slice(8, 10))}</strong>
              </span>
            ))}
          </div>
          <div className="semana-corpo" style={{ height: altura }}>
            <div className="semana-horas">
              {horas.map((m) => (
                <span key={m} style={{ top: (m - inicioMin) * pxMin }}>{String(m / 60).padStart(2, '0')}:00</span>
              ))}
            </div>
            {datas.map((data, i) => {
              const passado = data < hoje;
              return (
                <div key={data} className={'semana-col' + (data === hoje ? ' hoje' : '')}>
                  {horas.map((m) => <div key={m} className="semana-linha" style={{ top: (m - inicioMin) * pxMin }} />)}
                  {blocos.filter((b) => b.dia === i).map((b) => {
                    const d = ligacao.get(b.id);
                    const motivo = d
                      ? motivoSemAula(data, estado.calendario, d.turma, estado.periodosTurma, d.diasSemAula, estado.ausencias)
                      : ehAula(b) ? motivoSemAula(data, estado.calendario, '', [], [], estado.ausencias) : null;
                    const mod = d && !motivo ? moduloNoDia(d.id, data) : undefined;
                    // Disciplina anual (ensino geral): o módulo é a própria disciplina, não vale a pena repetir.
                    const mostrarMod = mod && !mod.anual;
                    const top = (minutos(b.inicio) - inicioMin) * pxMin;
                    const h = (minutos(b.fim) - minutos(b.inicio)) * pxMin - 3;
                    const nome = ehAula(b) ? sigla(b.titulo) : b.titulo;
                    const linha2 = [nomeTurmas(b.turmas), b.sala].filter(Boolean).join(' · ');
                    const titulo = `${b.inicio}–${b.fim} ${b.titulo}${linha2 ? `\n${linha2}` : ''}${mod ? `\n${mod.codigo ?? ''} ${mod.nome}` : ''}${motivo ? `\n${motivo}` : ''}`;
                    return (
                      <button
                        type="button"
                        key={b.id}
                        className={'semana-bloco' + (ehAula(b) ? '' : ' outro') + (passado ? ' passado' : '') + (motivo ? ' sem-aula' : '')}
                        style={{ top, height: h, ['--cor' as string]: d?.cor ?? 'var(--border)' }}
                        title={titulo}
                        disabled={!mod}
                        onClick={() => d && mod && onAbrir(d.id, mod.id)}
                      >
                        <span className="sb-nome">{nome}</span>
                        {linha2 && <span className="sb-sub">{linha2}</span>}
                        {motivo ? <span className="sb-mod">{motivo}</span> : mostrarMod && <span className="sb-mod">{mod.codigo?.replace(/^UC0*/, '') ?? mod.nome}</span>}
                      </button>
                    );
                  })}
                  {data === hoje && minAgora >= inicioMin && minAgora <= fimMin && <div className="semana-agora" style={{ top: (minAgora - inicioMin) * pxMin }} />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {blocos.length > 0 && !telemovel && estado.horario?.origem && (
        <p className="small muted">De {estado.horario.origem}{estado.horario.importado ? `, importado a ${estado.horario.importado.split('-').reverse().join('/')}` : ''}.</p>
      )}

      <Ausencias estado={estado} atualizar={atualizar} />
      {telemovel && <div className="row semana-importar">{importarBotao}</div>}
    </div>
  );
}

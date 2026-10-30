import { useMemo, useState } from 'react';
import { addDays, DIAS_SEMANA, uid, weekday } from '../lib/dates';
import { motivoSemAula, type PlanoDisciplina } from '../lib/engine';
import { blocosDoEstado, ehAula, faixas, minutos, nomeTurmas, sigla } from '../lib/horario';
import { MOTIVOS_AUSENCIA, type Ausencia, type Bloco, type Estado, type ISODate } from '../lib/types';
import { EscolherMotivo, nomeDoMotivo } from './Ausencias';

interface Props {
  estado: Estado;
  planos: PlanoDisciplina[];
  hoje: ISODate;
  telemovel: boolean;
  atualizar: (f: (e: Estado) => Estado) => void;
  onAbrir: (disciplinaId: string, moduloId: string) => void;
  /** Sem horário: leva às Disciplinas, onde se põem as aulas. */
  onIrDisciplinas: () => void;
}

const DIAS_EXTENSO = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
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

/** Grelha da semana, só para consulta: as aulas vêm das Disciplinas. */
export function HorarioSemana({ estado, planos, hoje, telemovel, atualizar, onAbrir, onIrDisciplinas }: Props) {
  const blocos = useMemo(() => blocosDoEstado(estado), [estado]);
  const lado = useMemo(() => faixas(blocos), [blocos]);
  const [segunda, setSegunda] = useState(() => segundaDe(hoje));
  // Aula tocada: dia, hora, turma e sala (como no horário da escola).
  const [detalhe, setDetalhe] = useState<{ bloco: Bloco; data: ISODate } | null>(null);
  // "Não houve aula", no cartão da aula.
  const [marcar, setMarcar] = useState<{ motivo: string; outro: string; todos: boolean } | null>(null);
  const fecharDetalhe = () => { setDetalhe(null); setMarcar(null); };

  const dias = blocos.some((b) => b.dia === 5) ? 6 : 5;
  const datas = Array.from({ length: dias }, (_, i) => addDays(segunda, i));
  const inicioMin = blocos.length ? Math.min(...blocos.map((b) => Math.floor(minutos(b.inicio) / 60) * 60)) : 8 * 60;
  const fimMin = blocos.length ? Math.max(...blocos.map((b) => Math.ceil(minutos(b.fim) / 60) * 60)) : 18 * 60;
  const pxMin = telemovel ? 0.95 : 1.15;
  const altura = (fimMin - inicioMin) * pxMin;
  const horas = Array.from({ length: (fimMin - inicioMin) / 60 + 1 }, (_, i) => inicioMin + i * 60);

  // Disciplina de cada bloco e o módulo dado em cada dia.
  const ligacao = useMemo(() => new Map(blocos.map((b) => [b.id, estado.disciplinas.find((d) => d.id === b.disciplinaId)])), [blocos, estado.disciplinas]);
  const moduloNoDia = (dId: string, data: ISODate) => {
    const p = planos.find((x) => x.disciplina.id === dId);
    const pm = p?.modulos.find((m) => m.sessoes.some((s) => s.data === data));
    return pm?.modulo;
  };

  /** Tempos desta disciplina neste dia, por ordem (para saber quais se perderam). */
  const blocosDoDia = (dId: string, dia: number) => blocos.filter((x) => x.disciplinaId === dId && x.dia === dia);

  /** Porque não há aula neste bloco nesta data: o dia todo, ou só alguns tempos da disciplina. */
  const semAula = (b: Bloco, data: ISODate): { motivo: string; ausencia?: Ausencia } | null => {
    const d = ligacao.get(b.id);
    const dia = d
      ? motivoSemAula(data, estado.calendario, d.turma, estado.periodosTurma, d.diasSemAula, estado.ausencias, d.id)
      : ehAula(b) ? motivoSemAula(data, estado.calendario, '', [], [], estado.ausencias) : null;
    if (dia) return { motivo: dia, ausencia: (estado.ausencias ?? []).find((a) => d && a.disciplinaId === d.id && !a.tempos && a.inicio === data) };
    if (!d) return null;
    const meus = blocosDoDia(d.id, b.dia);
    for (const a of estado.ausencias ?? []) {
      if (a.disciplinaId !== d.id || !a.tempos || a.inicio !== data) continue;
      const i = Math.max(0, meus.findIndex((x) => x.inicio >= (a.hora ?? '00:00')));
      if (meus.slice(i, i + a.tempos).some((x) => x.id === b.id)) return { motivo: a.nome, ausencia: a };
    }
    return null;
  };

  const gravarSemAula = () => {
    if (!detalhe || !marcar) return;
    const { bloco: b, data } = detalhe;
    const d = ligacao.get(b.id);
    if (!d) return;
    const n = blocosDoDia(d.id, b.dia).length;
    const nova: Ausencia = marcar.todos || n === 1
      ? { id: uid(), nome: nomeDoMotivo(marcar.motivo, marcar.outro), inicio: data, fim: data, disciplinaId: d.id }
      : { id: uid(), nome: nomeDoMotivo(marcar.motivo, marcar.outro), inicio: data, fim: data, disciplinaId: d.id, tempos: 1, hora: b.inicio };
    atualizar((e) => ({ ...e, ausencias: [...(e.ausencias ?? []), nova] }));
    fecharDetalhe();
  };

  const agora = new Date();
  const minAgora = agora.getHours() * 60 + agora.getMinutes();

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
          <p className="muted">{blocos.length ? `${intervaloSemana(segunda, dias)}` : 'Grelha semanal da escola: ficheiro .ics (ex.: inforarios.pt), PDF (ex.: Untis) ou à mão.'}</p>
        </div>
        <div className="row wrap">
          {!telemovel && blocos.length > 0 && setas}
        </div>
      </div>

      {!blocos.length && (
        <div className="empty">
          <p>Sem horário.</p>
          <p className="small muted">As aulas (dia, hora e tempos) entram em Disciplinas.</p>
          {!telemovel && <div className="row"><button className="btn primary" onClick={onIrDisciplinas}>Ir para Disciplinas</button></div>}
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
                    const motivo = semAula(b, data)?.motivo;
                    const mod = d && !motivo ? moduloNoDia(d.id, data) : undefined;
                    // Disciplina anual (ensino geral): o módulo é a própria disciplina, não vale a pena repetir.
                    const mostrarMod = mod && !mod.anual;
                    const top = (minutos(b.inicio) - inicioMin) * pxMin;
                    const h = (minutos(b.fim) - minutos(b.inicio)) * pxMin - 3;
                    const { faixa, n } = lado.get(b.id) ?? { faixa: 0, n: 1 };
                    const nome = ehAula(b) ? sigla(b.titulo) : b.titulo;
                    const linha2 = [nomeTurmas(b.turmas), b.sala].filter(Boolean).join(' · ');
                    const titulo = `${b.inicio}–${b.fim} ${b.titulo}${linha2 ? `\n${linha2}` : ''}${mod ? `\n${mod.codigo ?? ''} ${mod.nome}` : ''}${motivo ? `\n${motivo}` : ''}`;
                    return (
                      <button
                        type="button"
                        key={b.id}
                        className={'semana-bloco' + (ehAula(b) ? '' : ' outro') + (passado ? ' passado' : '') + (motivo ? ' sem-aula' : '')}
                        style={{ top, height: h, left: `calc(${(faixa / n) * 100}% + 2px)`, right: `calc(${((n - faixa - 1) / n) * 100}% + 2px)`, ['--cor' as string]: d?.cor ?? 'var(--border)' }}
                        title={titulo}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setDetalhe({ bloco: b, data });
                        }}
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

      {detalhe && (() => {
        const { bloco: b, data } = detalhe;
        const d = ligacao.get(b.id);
        const sa = semAula(b, data);
        const motivo = sa?.motivo;
        const mod = d && !motivo ? moduloNoDia(d.id, data) : undefined;
        const nDia = d ? blocosDoDia(d.id, b.dia).length : 0;
        const h = (x: string) => x.replace(':', 'h');
        return (
          <div className="sheet-backdrop center" onClick={fecharDetalhe}>
            <div className="dialog aula-detalhe" role="dialog" aria-modal="true" aria-label={b.titulo} onClick={(e) => e.stopPropagation()} style={{ ['--cor' as string]: d?.cor ?? 'var(--border)' }}>
              <p className="aula-quando">{DIAS_EXTENSO[b.dia]}, {data.slice(8, 10)}/{data.slice(5, 7)} · {h(b.inicio)}–{h(b.fim)}</p>
              <h2>{b.titulo}</h2>
              {ehAula(b) && sigla(b.titulo) !== b.titulo && <p className="muted aula-sigla">{sigla(b.titulo)}</p>}
              {(b.turmas.length > 0 || b.sala) && (
                <dl className="aula-dados">
                  {b.turmas.length > 0 && <div><dt>Turma</dt><dd>{nomeTurmas(b.turmas)}</dd></div>}
                  {b.sala && <div><dt>Sala</dt><dd>{b.sala}</dd></div>}
                </dl>
              )}
              {motivo && (
                <p className="warn">Sem aula: {motivo}
                  {sa?.ausencia && <> <button className="link-btn small" onClick={() => { atualizar((e) => ({ ...e, ausencias: (e.ausencias ?? []).filter((x) => x.id !== sa.ausencia!.id) })); fecharDetalhe(); }}>Anular</button></>}
                </p>
              )}
              {marcar && d && (
                <div className="nao-houve">
                  <div className="row wrap">
                    <EscolherMotivo motivo={marcar.motivo} outro={marcar.outro} onMotivo={(m) => setMarcar({ ...marcar, motivo: m })} onOutro={(t) => setMarcar({ ...marcar, outro: t })} />
                  </div>
                  {nDia > 1 && (
                    <div className="seg" role="radiogroup" aria-label="Tempos">
                      <button type="button" role="radio" aria-checked={!marcar.todos} className={!marcar.todos ? 'on' : ''} onClick={() => setMarcar({ ...marcar, todos: false })}>Só este tempo</button>
                      <button type="button" role="radio" aria-checked={marcar.todos} className={marcar.todos ? 'on' : ''} onClick={() => setMarcar({ ...marcar, todos: true })}>Os {nDia} tempos do dia</button>
                    </div>
                  )}
                </div>
              )}
              {mod && !mod.anual && (
                <p className="aula-modulo"><small className="muted">Neste dia</small><br />{mod.codigo ? `${mod.codigo} · ` : ''}{mod.nome}</p>
              )}
              {marcar ? (
                <div className="row wrap end">
                  <button className="btn" onClick={() => setMarcar(null)}>Cancelar</button>
                  <button className="btn primary" onClick={gravarSemAula}>Gravar</button>
                </div>
              ) : (
                <div className="row wrap end">
                  {d && !motivo && <button className="btn" onClick={() => setMarcar({ motivo: MOTIVOS_AUSENCIA[0], outro: '', todos: false })}>Não houve aula</button>}
                  {d && mod && <button className="btn" onClick={() => { fecharDetalhe(); onAbrir(d.id, mod.id); }}>{mod.anual ? 'Ver disciplina' : 'Ver módulo'}</button>}
                  <button className="btn primary" onClick={fecharDetalhe}>Fechar</button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

    </div>
  );
}

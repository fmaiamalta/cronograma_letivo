import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { addDays, diffDays, fmtLong, fmtShort, MESES } from '../lib/dates';
import type { PlanoDisciplina } from '../lib/engine';
import { ehGeral, ENSINOS, ensinoDe, type Ausencia, type CalendarioEscolar, type ISODate, type PeriodoTurma } from '../lib/types';
import { fimDoMes, primeiroDoMes, quebrasDe, trocos } from './Gantt';

interface Props {
  calendario: CalendarioEscolar;
  planos: PlanoDisciplina[];
  periodosTurma: PeriodoTurma[];
  ausencias: Ausencia[];
  hoje: ISODate;
  /** 1 = o ano inteiro cabe na largura do ecrã; 2, 3, ... = zoom. */
  zoom: number;
  onAbrir: (disciplinaId: string, moduloId: string) => void;
}

/**
 * Cronograma para telemóvel: sem coluna de nomes (o nome vai por cima da
 * barra e acompanha o deslize lateral) e, por defeito, o ano inteiro no ecrã.
 */
export function GanttCompacto({ calendario, planos, periodosTurma, ausencias, hoje, zoom, onAbrir }: Props) {
  const caixa = useRef<HTMLDivElement>(null);
  const faixa = useRef<HTMLDivElement>(null);
  const cabeca = useRef<HTMLDivElement>(null);
  const [larguraVisivel, setLarguraVisivel] = useState(360);

  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medir = () => setLarguraVisivel(el.clientWidth);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const inicio = primeiroDoMes(calendario.inicio);
  const fimAno = planos.reduce((m, p) => (p.fim > m ? p.fim : m), Object.values(calendario.fimPorAno).reduce((a, b) => (b! > a! ? b : a))!);
  const fim = fimDoMes(fimAno);
  const dias = diffDays(inicio, fim) + 1;
  const pxDia = (larguraVisivel / dias) * zoom;
  const largura = dias * pxDia;
  const x = (iso: ISODate) => diffDays(inicio, iso) * pxDia;

  const meses = useMemo(() => {
    const out: { iso: ISODate; nome: string }[] = [];
    for (let d = inicio; d <= fim; d = addDays(fimDoMes(d), 1)) out.push({ iso: d, nome: MESES[Number(d.slice(5, 7)) - 1] });
    return out;
  }, [inicio, fim]);
  const hojeVisivel = hoje >= inicio && hoje <= fim;

  // Etiquetas das interrupções em duas linhas, para não se taparem.
  const interrupcoes = useMemo(() => {
    const fimLinha = [-Infinity, -Infinity];
    return calendario.interrupcoes.map((i) => {
      const texto = `${fmtShort(i.inicio)}–${fmtShort(i.fim)}`;
      const w = texto.length * 5.6 + 8;
      const centro = x(i.inicio) + ((diffDays(i.inicio, i.fim) + 1) * pxDia) / 2;
      const left = Math.max(0, Math.min(largura - w, centro - w / 2));
      const linha = left > fimLinha[0] + 3 ? 0 : 1;
      fimLinha[linha] = left + w;
      return { i, texto, left, linha };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendario.interrupcoes, pxDia, largura]);

  // Com zoom, abre com o dia de hoje a um terço do ecrã.
  useEffect(() => {
    const el = faixa.current;
    if (!el) return;
    el.scrollLeft = hojeVisivel ? Math.max(0, x(hoje) - el.clientWidth / 3) : 0;
    if (cabeca.current) cabeca.current.style.transform = `translateX(${-el.scrollLeft}px)`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, larguraVisivel]);

  if (!planos.length) return null;

  // Rótulos de cada linha. Vão duas vezes: escondidos junto às barras (para dar
  // a mesma altura às linhas) e visíveis na camada de cima, que não desliza para o lado.
  const rotuloEnsino = (idx: number) => {
    const d = planos[idx].disciplina;
    return new Set(planos.map((x) => ensinoDe(x.disciplina))).size > 1 && (idx === 0 || ensinoDe(planos[idx - 1].disciplina) !== ensinoDe(d))
      ? <div className="gc-ensino"><span className="gc-sticky">Ensino {ENSINOS.find((e) => e.id === ensinoDe(d))!.nome.toLowerCase()}</span></div>
      : null;
  };
  const rotuloGrupo = (idx: number) => {
    const d = planos[idx].disciplina;
    return ehGeral(d) ? null : <div className="gc-group"><span className="gc-sticky">{d.turma} | {d.nome}</span></div>;
  };
  const rotuloModulo = (idx: number, pm: PlanoDisciplina['modulos'][number]) => {
    const d = planos[idx].disciplina;
    const m = pm.modulo;
    return (
      <span className="gc-sticky gc-mod">
        {ehGeral(d) ? <strong>{d.turma} | {d.nome}</strong> : <>{m.codigo ? `${m.codigo.replace(/^UC0*/, '')} · ` : ''}{m.nome}</>}
        {pm.inicio && <b> {fmtShort(pm.inicio)}–{fmtShort(pm.fim!)}</b>}
      </span>
    );
  };

  return (
    <div className="gc" ref={caixa}>
      <div className="gc-head">
        <div className="gc-head-track" ref={cabeca} style={{ width: largura }}>
          {meses.map((m) => (
            <div key={m.iso} className="gc-month" style={{ left: x(m.iso), width: (diffDays(m.iso, fimDoMes(m.iso)) + 1) * pxDia }}>
              {m.nome}
            </div>
          ))}
          {interrupcoes.map(({ i, texto, left, linha }) => (
            <span key={i.id} className={'gc-break-date l' + linha} style={{ left }} title={`${i.nome}: ${fmtLong(i.inicio)} a ${fmtLong(i.fim)}`}>
              {texto}
            </span>
          ))}
          {hojeVisivel && <span className="gc-hoje" style={{ left: x(hoje) + pxDia / 2 }}>{fmtShort(hoje)}</span>}
        </div>
      </div>

      <div className="gc-corpo">
        {/* Só desliza na horizontal; a caixa de fora só na vertical. */}
        <div className="gc-x" ref={faixa} onScroll={(e) => {
          if (cabeca.current) cabeca.current.style.transform = `translateX(${-e.currentTarget.scrollLeft}px)`;
        }}>
          <div className="gc-body" style={{ width: largura }}>
            <div className="gc-overlay" aria-hidden>
              {meses.map((m) => <div key={m.iso} className="gantt-gridline" style={{ left: x(m.iso) }} />)}
              {calendario.interrupcoes.map((i) => (
                <div key={i.id} className="gantt-break" style={{ left: x(i.inicio), width: (diffDays(i.inicio, i.fim) + 1) * pxDia }} />
              ))}
              {ausencias.map((a) => (
                <div key={a.id} className="gantt-ausencia" style={{ left: x(a.inicio), width: Math.max(2, (diffDays(a.inicio, a.fim) + 1) * pxDia) }} />
              ))}
              {calendario.feriados.map((f) => <div key={f.id} className="gantt-holiday" style={{ left: x(f.data) + pxDia / 2 }} />)}
              {hojeVisivel && <div className="gantt-today" style={{ left: x(hoje) + pxDia / 2 }} />}
            </div>

            {planos.map((p, idx) => {
              const d = p.disciplina;
              const periodos = periodosTurma.filter((pt) => pt.turma === d.turma);
              const quebras = quebrasDe(calendario, periodos, ausencias, d.diasSemAula);
              return (
                <section key={d.id} className="gc-oculto" style={{ ['--cor' as string]: d.cor }}>
                  {rotuloEnsino(idx)}
                  {rotuloGrupo(idx)}
                  {p.modulos.map((pm) => {
                    const m = pm.modulo;
                    return (
                      <div key={m.id} className="gc-row" onClick={() => onAbrir(d.id, m.id)}>
                        {rotuloModulo(idx, pm)}
                        {periodos.map((pt) => (
                          <div key={pt.id} className="gantt-turma-block" style={{ left: x(pt.inicio), width: (diffDays(pt.inicio, pt.fim) + 1) * pxDia }} />
                        ))}
                        {trocos(pm, quebras).map(([a, b]) => {
                          const ini = x(a);
                          const fimX = x(b) + pxDia;
                          const corte = Math.min(Math.max(x(hoje) + pxDia, ini), fimX);
                          return (
                            <div key={a} className="gc-bar" style={{ left: ini, width: Math.max(2, fimX - ini) }}>
                              {corte > ini && <span className="gantt-bar-done" style={{ width: corte - ini }} />}
                            </div>
                          );
                        })}
                        {m.tarefas.filter((t) => t.data).map((t) => {
                          const est = t.feita ? ' done' : (t.fim ?? t.data!) < hoje ? ' late' : '';
                          return t.fim ? (
                            <span key={t.id} className={'gc-task-range' + est} style={{ left: x(t.data!), width: Math.max(3, x(t.fim) + pxDia - x(t.data!)) }} />
                          ) : (
                            <span key={t.id} className={'gc-task' + est} style={{ left: x(t.data!) + pxDia / 2 }} />
                          );
                        })}
                      </div>
                    );
                  })}
                </section>
              );
            })}
          </div>
        </div>

        <div className="gc-rotulos" aria-hidden>
          {planos.map((p, idx) => (
            <section key={p.disciplina.id} style={{ ['--cor' as string]: p.disciplina.cor }}>
              {rotuloEnsino(idx)}
              {rotuloGrupo(idx)}
              {p.modulos.map((pm) => <div key={pm.modulo.id} className="gc-row">{rotuloModulo(idx, pm)}</div>)}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, diffDays, fmtLong, fmtShort, MESES } from '../lib/dates';
import type { PlanoDisciplina, PlanoModulo } from '../lib/engine';
import type { CalendarioEscolar, ISODate, PeriodoTurma } from '../lib/types';
import { COMPONENTES, ehGeral, ENSINOS, ensinoDe } from '../lib/types';

interface Props {
  calendario: CalendarioEscolar;
  planos: PlanoDisciplina[];
  periodosTurma: PeriodoTurma[];
  hoje: ISODate;
  pxDia: number;
  onAbrir: (disciplinaId: string, moduloId: string) => void;
}

function larguraRotulo(): number {
  return typeof window !== 'undefined' && window.innerWidth < 760 ? 150 : 220;
}

export function primeiroDoMes(iso: ISODate): ISODate {
  return iso.slice(0, 8) + '01';
}

export function fimDoMes(iso: ISODate): ISODate {
  const [y, m] = iso.split('-').map(Number);
  const prox = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return addDays(prox, -1);
}

/** Separa as aulas de um módulo em troços, partidos por interrupções e períodos sem aulas. */
export function trocos(pm: PlanoModulo, quebras: { inicio: ISODate; fim: ISODate }[]): [ISODate, ISODate][] {
  const out: [ISODate, ISODate][] = [];
  const s = pm.sessoes;
  if (!s.length) return out;
  let ini = s[0].data;
  for (let i = 1; i < s.length; i++) {
    const a = s[i - 1].data;
    const b = s[i].data;
    if (quebras.some((q) => q.inicio > a && q.inicio < b)) {
      out.push([ini, a]);
      ini = b;
    }
  }
  out.push([ini, s[s.length - 1].data]);
  return out;
}

interface Etiqueta {
  chave: string;
  texto: string;
  left: number;
}

/**
 * Datas de início e fim de cada troço. Num troço curto vai uma só etiqueta
 * ("12/02–15/02"). Se uma etiqueta tapar a anterior, desliza para a direita.
 */
function etiquetasTrocos(lista: [ISODate, ISODate][], x: (d: ISODate) => number, pxDia: number): Etiqueta[] {
  const largura = (t: string) => t.length * 6.3 + 10; // estimativa para 0.66rem em negrito
  const brutas: { chave: string; texto: string; left: number }[] = [];
  for (const [a, b] of lista) {
    const ini = x(a);
    const fim = x(b) + pxDia;
    if (a === b || fim - ini < 76) {
      const texto = a === b ? fmtShort(a) : `${fmtShort(a)}–${fmtShort(b)}`;
      brutas.push({ chave: a, texto, left: (ini + fim) / 2 - largura(texto) / 2 });
    } else {
      brutas.push({ chave: a, texto: fmtShort(a), left: ini });
      brutas.push({ chave: a + 'f', texto: fmtShort(b), left: fim - largura(fmtShort(b)) });
    }
  }
  let ultimoFim = -Infinity;
  return brutas.map((e) => {
    const left = Math.max(e.left, ultimoFim + 3);
    ultimoFim = left + largura(e.texto);
    return { ...e, left };
  });
}

export function Gantt({ calendario, planos, periodosTurma, hoje, pxDia, onAbrir }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [LARGURA_ROTULO, setRotulo] = useState(larguraRotulo);
  useEffect(() => {
    const f = () => setRotulo(larguraRotulo());
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);

  const inicio = primeiroDoMes(calendario.inicio);
  const fimAno = planos.reduce(
    (m, p) => (p.fim > m ? p.fim : m),
    Object.values(calendario.fimPorAno).reduce((a, b) => (b! > a! ? b : a))!,
  );
  const fim = fimDoMes(fimAno);
  const dias = diffDays(inicio, fim) + 1;
  const largura = dias * pxDia;
  const x = (iso: ISODate) => diffDays(inicio, iso) * pxDia;

  const meses = useMemo(() => {
    const out: { iso: ISODate; nome: string }[] = [];
    for (let d = inicio; d <= fim; d = addDays(fimDoMes(d), 1)) out.push({ iso: d, nome: MESES[Number(d.slice(5, 7)) - 1] });
    return out;
  }, [inicio, fim]);

  const hojeVisivel = hoje >= inicio && hoje <= fim;

  useEffect(() => {
    const el = scroller.current;
    if (!el || !hojeVisivel) return;
    // Deixa o dia de hoje a um terço da zona visível das barras.
    el.scrollLeft = Math.max(0, x(hoje) - (el.clientWidth - LARGURA_ROTULO) / 3);
    // Só ao abrir e quando muda o zoom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pxDia, LARGURA_ROTULO]);

  if (!planos.length) return null;

  return (
    <div className="gantt" ref={scroller} style={{ ['--rotulo' as string]: `${LARGURA_ROTULO}px` }}>
      <div className="gantt-inner" style={{ width: LARGURA_ROTULO + largura }}>
        <div className="gantt-head">
          <div className="gantt-label gantt-corner">{calendario.anoLetivo}</div>
          <div className="gantt-track" style={{ width: largura }}>
            {meses.map((m) => (
              <div key={m.iso} className="gantt-month" style={{ left: x(m.iso), width: (diffDays(m.iso, fimDoMes(m.iso)) + 1) * pxDia }}>
                {m.nome}
              </div>
            ))}
            {calendario.interrupcoes.map((i) => {
              const ini = x(i.inicio);
              const larg = (diffDays(i.inicio, i.fim) + 1) * pxDia;
              const titulo = `${i.nome}: ${fmtLong(i.inicio)} a ${fmtLong(i.fim)}`;
              // Faixa estreita: uma só etiqueta ao centro; larga: uma em cada ponta.
              return larg >= 90 ? (
                <span key={i.id} title={titulo}>
                  <span className="gantt-date gantt-break-date" style={{ left: ini }}>{fmtShort(i.inicio)}</span>
                  <span className="gantt-date gantt-break-date end" style={{ left: ini + larg }}>{fmtShort(i.fim)}</span>
                </span>
              ) : (
                <span key={i.id} className="gantt-date gantt-break-date mid" style={{ left: ini + larg / 2 }} title={titulo}>
                  {fmtShort(i.inicio)}–{fmtShort(i.fim)}
                </span>
              );
            })}
            {hojeVisivel && (
              <div className="gantt-today-pill" style={{ left: x(hoje) + pxDia / 2 }}>
                Hoje {fmtShort(hoje)}
              </div>
            )}
          </div>
        </div>

        <div className="gantt-body">
          <div className="gantt-overlay" style={{ left: LARGURA_ROTULO, width: largura }} aria-hidden>
            {meses.map((m) => (
              <div key={m.iso} className="gantt-gridline" style={{ left: x(m.iso) }} />
            ))}
            {calendario.interrupcoes.map((i) => (
              <div key={i.id} className="gantt-break" style={{ left: x(i.inicio), width: (diffDays(i.inicio, i.fim) + 1) * pxDia }}>
                <span>{i.nome}</span>
              </div>
            ))}
            {calendario.feriados.map((f) => (
              <div key={f.id} className="gantt-holiday" title={`${f.nome} (${fmtLong(f.data)})`} style={{ left: x(f.data) + pxDia / 2 }} />
            ))}
            {hojeVisivel && <div className="gantt-today" style={{ left: x(hoje) + pxDia / 2 }} />}
          </div>

          {planos.map((p, idx) => {
            const d = p.disciplina;
            const periodos = periodosTurma.filter((pt) => pt.turma === d.turma);
            const quebras = [...calendario.interrupcoes, ...periodos];
            const comp = COMPONENTES.find((c) => c.id === d.componente)?.nome;
            const falta = p.temposNecessarios - p.temposDisponiveis;
            // Ensino geral: a disciplina é uma só linha, sem cabeçalho de grupo.
            const geral = ehGeral(d);
            return (
              <section key={d.id} className={'gantt-group' + (geral ? ' geral' : '')} style={{ ['--cor' as string]: d.cor }}>
                {/* Linha grossa a separar os tipos de ensino, quando há mais do que um. */}
                {new Set(planos.map((x) => ensinoDe(x.disciplina))).size > 1 && (idx === 0 || ensinoDe(planos[idx - 1].disciplina) !== ensinoDe(d)) && (
                  <div className="gantt-ensino">
                    <span className="gantt-label">Ensino {ENSINOS.find((e) => e.id === ensinoDe(d))!.nome.toLowerCase()}</span>
                  </div>
                )}
                {!geral && <div className="gantt-row gantt-row-group">
                  <div className="gantt-label">
                    <strong>{d.turma} | {d.nome}</strong>
                    <small>{comp}{falta > 0 && <span className="warn"> · faltam {falta} tempos</span>}</small>
                  </div>
                  <div className="gantt-track" style={{ width: largura }} />
                </div>}
                {p.modulos.map((pm) => {
                  const m = pm.modulo;
                  const pct = pm.totalTempos ? Math.round((pm.dados / pm.totalTempos) * 100) : 0;
                  return (
                    <div className="gantt-row" key={m.id}>
                      <button className="gantt-label gantt-mod" onClick={() => onAbrir(d.id, m.id)}>
                        <span className="mod-name">{geral ? <strong>{d.turma} | {d.nome}</strong> : <>{m.codigo ? `${m.codigo} · ` : ''}{m.nome}</>}</span>
                        <small>
                          {pm.inicio ? `${fmtLong(pm.inicio)} a ${fmtLong(pm.fim!)}` : 'sem aulas marcadas'} | {pm.totalTempos} tempos
                        </small>
                        <span className="mod-progress" aria-label={`${pct}% dado`}>
                          <span style={{ width: `${pct}%` }} />
                        </span>
                        {pm.emFalta > 0 && <small className="warn">Não cabe: faltam {pm.emFalta} tempos</small>}
                      </button>
                      <div className="gantt-track" style={{ width: largura }}>
                        {periodos.map((pt) => (
                          <div key={pt.id} className="gantt-turma-block" style={{ left: x(pt.inicio), width: (diffDays(pt.inicio, pt.fim) + 1) * pxDia }} title={`${pt.nome}: ${fmtLong(pt.inicio)} a ${fmtLong(pt.fim)}`}>
                            <span>{pt.nome}</span>
                          </div>
                        ))}
                        {trocos(pm, quebras).map(([a, b]) => {
                          // Barra contínua de a até ao fim do dia b; a parte já dada fica mais forte.
                          const ini = x(a);
                          const fimX = x(b) + pxDia;
                          const corte = Math.min(Math.max(x(hoje) + pxDia, ini), fimX);
                          const aulas = pm.sessoes.filter((s) => s.data >= a && s.data <= b).length;
                          const titulo = `${fmtLong(a)} a ${fmtLong(b)} · ${aulas} ${aulas === 1 ? 'aula' : 'aulas'}`;
                          return (
                            <div key={a} className="gantt-bar" style={{ left: ini, width: fimX - ini }} title={titulo}>
                              {corte > ini && <span className="gantt-bar-done" style={{ width: corte - ini }} />}
                            </div>
                          );
                        })}
                        {etiquetasTrocos(trocos(pm, quebras), x, pxDia).map((e) => (
                          <span key={e.chave} className="gantt-date" style={{ left: e.left }}>{e.texto}</span>
                        ))}
                        {m.tarefas.filter((t) => t.data).map((t) => {
                          const estado = t.feita ? ' done' : (t.fim ?? t.data!) < hoje ? ' late' : '';
                          const titulo = `${t.feita ? '✓ ' : ''}${t.titulo} (${fmtLong(t.data!)}${t.fim ? ` a ${fmtLong(t.fim)}` : ''})${t.descricao ? `\n${t.descricao}` : ''}`;
                          // Tarefa com período: faixa entre o início e o fim; de um dia: losango.
                          return t.fim ? (
                            <button
                              key={t.id}
                              className={'gantt-task-range' + estado}
                              style={{ left: x(t.data!), width: Math.max(pxDia, x(t.fim) + pxDia - x(t.data!)) }}
                              title={titulo}
                              onClick={() => onAbrir(d.id, m.id)}
                              aria-label={`Tarefa: ${t.titulo}`}
                            />
                          ) : (
                            <button
                              key={t.id}
                              className={'gantt-task' + estado}
                              style={{ left: x(t.data!) + pxDia / 2 }}
                              title={titulo}
                              onClick={() => onAbrir(d.id, m.id)}
                              aria-label={`Tarefa: ${t.titulo}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

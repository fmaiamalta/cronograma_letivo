import { useState } from 'react';
import { addDays, fmtLong, todayISO, uid, weekday } from '../lib/dates';
import { limitesDisciplina, motivoSemAula } from '../lib/engine';
import { aulasDe, temposDaDisciplina } from '../lib/horario';
import { MOTIVOS_AUSENCIA, type Ausencia, type Disciplina, type Estado } from '../lib/types';
import { IconTrash } from './icons';

interface Props {
  estado: Estado;
  atualizar: (f: (e: Estado) => Estado) => void;
}

/** Tempos de aula perdidos, somando as disciplinas abrangidas. */
export function temposPerdidos(a: Ausencia, estado: Estado): number {
  if (a.tempos) return a.tempos;
  let total = 0;
  for (const d of estado.disciplinas) {
    if (a.disciplinaId && a.disciplinaId !== d.id) continue;
    const { inicio, fim } = limitesDisciplina(d, estado.calendario);
    const tempos = temposDaDisciplina(d, estado);
    for (let data = a.inicio; data <= a.fim; data = addDays(data, 1)) {
      if (data < inicio || data > fim) continue;
      const t = tempos[weekday(data)] ?? 0;
      if (t > 0 && !motivoSemAula(data, estado.calendario, d.turma, estado.periodosTurma, d.diasSemAula)) total += t;
    }
  }
  return total;
}

/** Motivo: um da lista ou, com "Outro", o que se escrever (ex.: consulta médica). */
export function EscolherMotivo({ motivo, outro, onMotivo, onOutro }: { motivo: string; outro: string; onMotivo: (m: string) => void; onOutro: (t: string) => void }) {
  return (
    <>
      <select value={motivo} onChange={(e) => onMotivo(e.target.value)} aria-label="Motivo">
        {MOTIVOS_AUSENCIA.map((m) => <option key={m}>{m}</option>)}
      </select>
      {motivo === 'Outro' && <input value={outro} onChange={(e) => onOutro(e.target.value)} placeholder="Consulta médica" aria-label="Qual" autoFocus />}
    </>
  );
}

export function nomeDoMotivo(motivo: string, outro: string): string {
  return motivo === 'Outro' ? outro.trim() || 'Outro' : motivo;
}

/**
 * Sem aulas: greve, doença, consulta... De todas as disciplinas (um dia ou um
 * período) ou de uma só (o dia todo ou só alguns tempos). No profissional, os
 * módulos avançam o que se perdeu.
 */
export function Ausencias({ estado, atualizar }: Props) {
  const lista = [...(estado.ausencias ?? [])].sort((a, b) => b.inicio.localeCompare(a.inicio));
  const [motivo, setMotivo] = useState(MOTIVOS_AUSENCIA[0]);
  const [outro, setOutro] = useState('');
  const [uma, setUma] = useState(false);
  const [dId, setDId] = useState(estado.disciplinas[0]?.id ?? '');
  const [inicio, setInicio] = useState(todayISO());
  const [fim, setFim] = useState('');
  const [tempos, setTempos] = useState(0); // 0 = todos os desse dia
  const [conta, setConta] = useState(false);

  // Uma disciplina: só as que têm aula no dia escolhido (horário, datas da disciplina, sem feriado nem interrupção).
  const disponiveis = inicio
    ? estado.disciplinas.filter((x) => {
        const t = temposDaDisciplina(x, estado)[weekday(inicio)] ?? 0;
        const { inicio: ini, fim } = limitesDisciplina(x, estado.calendario);
        return t > 0 && inicio >= ini && inicio <= fim && !motivoSemAula(inicio, estado.calendario, x.turma, estado.periodosTurma, x.diasSemAula);
      })
    : [];
  const d = disponiveis.find((x) => x.id === dId) ?? disponiveis[0];
  const nesseDia = d && inicio ? temposDaDisciplina(d, estado)[weekday(inicio)] ?? 0 : 0;
  /** "10M | SI · 14h30 · 2 tempos" */
  const rotulo = (x: Disciplina) => {
    const aulas = aulasDe(x, estado).filter((a) => a.dia === weekday(inicio));
    const n = temposDaDisciplina(x, estado)[weekday(inicio)];
    return `${x.turma} | ${x.nome || 'Sem nome'}${aulas.length ? ` · ${aulas.map((a) => a.inicio.replace(':', 'h')).join(', ')}` : ''} · ${n} ${n === 1 ? 'tempo' : 'tempos'}`;
  };

  const adicionar = () => {
    if (!inicio || (uma && !d)) return;
    const nova: Ausencia = uma
      ? { id: uid(), nome: nomeDoMotivo(motivo, outro), inicio, fim: inicio, disciplinaId: d!.id, tempos: tempos && tempos < nesseDia ? tempos : undefined, conta: conta || undefined }
      : { id: uid(), nome: nomeDoMotivo(motivo, outro), inicio, fim: fim && fim > inicio ? fim : inicio, conta: conta || undefined };
    atualizar((e) => ({ ...e, ausencias: [...(e.ausencias ?? []), nova] }));
    setFim('');
    setOutro('');
    setTempos(0);
    setConta(false);
  };
  const mudar = (id: string, m: Partial<Ausencia>) => atualizar((e) => ({ ...e, ausencias: (e.ausencias ?? []).map((a) => (a.id === id ? { ...a, ...m } : a)) }));
  const apagar = (id: string) => atualizar((e) => ({ ...e, ausencias: (e.ausencias ?? []).filter((a) => a.id !== id) }));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Sem aulas</h1>
          <p className="muted">Greve, doença, consulta, formação. No profissional, os módulos avançam o que se perdeu, exceto se contar como aula.</p>
        </div>
      </div>

      <section className="card plain ausencias">
        <div className="seg" role="radiogroup" aria-label="Abrange">
          <button type="button" role="radio" aria-checked={!uma} className={!uma ? 'on' : ''} onClick={() => setUma(false)}>Todas as disciplinas</button>
          <button type="button" role="radio" aria-checked={uma} className={uma ? 'on' : ''} onClick={() => setUma(true)} disabled={!estado.disciplinas.length}>Uma disciplina</button>
        </div>
        <div className="row wrap ausencias-form">
          <EscolherMotivo motivo={motivo} outro={outro} onMotivo={setMotivo} onOutro={setOutro} />
          <input type="date" value={inicio} onChange={(e) => { setInicio(e.target.value); setTempos(0); }} aria-label={uma ? 'Dia' : 'Primeiro dia'} />
          {uma && disponiveis.length > 0 && (
            <select value={d?.id ?? ''} onChange={(e) => { setDId(e.target.value); setTempos(0); }} aria-label="Disciplina">
              {disponiveis.map((x) => <option key={x.id} value={x.id}>{rotulo(x)}</option>)}
            </select>
          )}
          {!uma && <input type="date" value={fim} min={inicio || undefined} onChange={(e) => setFim(e.target.value)} aria-label="Último dia (opcional)" />}
          {uma && nesseDia > 1 && (
            <select value={tempos} onChange={(e) => setTempos(Number(e.target.value))} aria-label="Tempos">
              <option value={0}>Os {nesseDia} tempos</option>
              {Array.from({ length: nesseDia - 1 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} {n === 1 ? 'tempo' : 'tempos'}</option>)}
            </select>
          )}
          <button className="btn primary" disabled={!inicio || (uma && (!d || nesseDia === 0))} onClick={adicionar}>Adicionar</button>
        </div>
        <label className="check-linha conta-aula">
          <input type="checkbox" checked={conta} onChange={(e) => setConta(e.target.checked)} />
          Conta como aula (sumário numerado): o cronograma não avança
        </label>
        {uma && inicio && !disponiveis.length && <p className="small warn">Sem aulas neste dia.</p>}
      </section>

      {lista.length > 0 && (
        <section className="card plain">
          <ul className="ausencias-lista">
            {lista.map((a) => {
              const t = temposPerdidos(a, estado);
              const disc = a.disciplinaId ? estado.disciplinas.find((x) => x.id === a.disciplinaId) : undefined;
              return (
                <li key={a.id}>
                  <span className="grow">
                    <strong>{a.nome}</strong> {a.inicio === a.fim ? fmtLong(a.inicio) : `${fmtLong(a.inicio)} a ${fmtLong(a.fim)}`}
                    <small className="muted"> · {disc ? `${disc.turma} | ${disc.nome}` : a.disciplinaId ? 'disciplina apagada' : 'todas'} · {a.conta ? 'conta como aula' : `${t} ${t === 1 ? 'tempo' : 'tempos'}`}</small>
                  </span>
                  <label className="conta-toggle" title="Sumário numerado: o cronograma não avança">
                    <input type="checkbox" checked={!!a.conta} onChange={(e) => mudar(a.id, { conta: e.target.checked || undefined })} />
                    Conta
                  </label>
                  <button className="icon-btn" onClick={() => apagar(a.id)} aria-label={`Apagar ${a.nome} de ${fmtLong(a.inicio)}`}><IconTrash /></button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

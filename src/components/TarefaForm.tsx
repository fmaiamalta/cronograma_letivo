import { useState } from 'react';
import { todayISO, uid } from '../lib/dates';
import type { Ano, Estado, Tarefa } from '../lib/types';

export interface DestinoTarefa {
  dId: string;
  mId: string;
  tarefa: Tarefa;
}

interface Props {
  estado: Estado;
  /** Tarefa a editar (com o sítio onde está), ou nada para criar uma nova. */
  inicial?: DestinoTarefa;
  onGravar: (antes: DestinoTarefa | undefined, depois: DestinoTarefa) => void;
  onApagar?: () => void;
  onFechar: () => void;
}

/** Criar ou editar uma tarefa: nome, descrição, data ou período e o módulo a que pertence. */
export function TarefaForm({ estado, inicial, onGravar, onApagar, onFechar }: Props) {
  const ds = estado.disciplinas;
  const dIni = ds.find((d) => d.id === inicial?.dId) ?? ds[0];
  const t0 = inicial?.tarefa;

  const [titulo, setTitulo] = useState(t0?.titulo ?? '');
  const [descricao, setDescricao] = useState(t0?.descricao ?? '');
  const [periodo, setPeriodo] = useState(!!t0?.fim);
  const [data, setData] = useState(t0?.data ?? todayISO());
  const [fim, setFim] = useState(t0?.fim ?? t0?.data ?? todayISO());
  const [ano, setAno] = useState<Ano | undefined>(dIni?.ano);
  const [turma, setTurma] = useState(dIni?.turma ?? '');
  const [dId, setDId] = useState(dIni?.id ?? '');
  const [mId, setMId] = useState(inicial?.mId ?? dIni?.modulos[0]?.id ?? '');

  const anos = [...new Set(ds.map((d) => d.ano))].sort();
  const turmas = [...new Set(ds.filter((d) => d.ano === ano).map((d) => d.turma))].sort();
  const disciplinas = ds.filter((d) => d.ano === ano && d.turma === turma);
  const modulos = ds.find((d) => d.id === dId)?.modulos ?? [];

  // Cada escolha reinicia as seguintes com a primeira opção disponível.
  const escolherAno = (a: Ano) => {
    setAno(a);
    const t = [...new Set(ds.filter((d) => d.ano === a).map((d) => d.turma))].sort()[0] ?? '';
    escolherTurma(t, a);
  };
  const escolherTurma = (t: string, a = ano) => {
    setTurma(t);
    escolherDisciplina(ds.find((d) => d.ano === a && d.turma === t)?.id ?? '');
  };
  const escolherDisciplina = (id: string) => {
    setDId(id);
    setMId(ds.find((d) => d.id === id)?.modulos[0]?.id ?? '');
  };

  const valido = titulo.trim() && dId && mId && data && (!periodo || fim >= data);

  const gravar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valido) return;
    onGravar(inicial, {
      dId,
      mId,
      tarefa: {
        id: t0?.id ?? uid(),
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
        data,
        fim: periodo && fim !== data ? fim : undefined,
        feita: t0?.feita ?? false,
      },
    });
  };

  if (!ds.length) {
    return (
      <div className="sheet-backdrop center" onClick={onFechar}>
        <div className="dialog" onClick={(e) => e.stopPropagation()}>
          <h2>Nova tarefa</h2>
          <p>Sem disciplinas no horário.</p>
          <div className="row end"><button className="btn" onClick={onFechar}>Fechar</button></div>
        </div>
      </div>
    );
  }

  return (
    <div className="sheet-backdrop center" onClick={onFechar}>
      <form className="dialog tarefa-form" role="dialog" aria-modal="true" aria-label={inicial ? 'Editar tarefa' : 'Nova tarefa'} onClick={(e) => e.stopPropagation()} onSubmit={gravar}>
        <h2>{inicial ? 'Editar tarefa' : 'Nova tarefa'}</h2>
        <label>Nome<input value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus placeholder="Entrega do trabalho 1" /></label>
        <label>Descrição<textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} /></label>

        <div className="seg" role="radiogroup" aria-label="Tipo de data">
          <button type="button" role="radio" aria-checked={!periodo} className={!periodo ? 'on' : ''} onClick={() => setPeriodo(false)}>Um dia</button>
          <button type="button" role="radio" aria-checked={periodo} className={periodo ? 'on' : ''} onClick={() => setPeriodo(true)}>Início e fim</button>
        </div>
        <div className="grid-2">
          <label>{periodo ? 'Início' : 'Data'}<input type="date" value={data} onChange={(e) => { setData(e.target.value); if (fim < e.target.value) setFim(e.target.value); }} /></label>
          {periodo && <label>Fim<input type="date" value={fim} min={data} onChange={(e) => setFim(e.target.value)} /></label>}
        </div>

        <div className="grid-2">
          <label>Ano
            <select value={ano ?? ''} onChange={(e) => escolherAno(Number(e.target.value) as Ano)}>
              {anos.map((a) => <option key={a} value={a}>{a}.º</option>)}
            </select>
          </label>
          <label>Turma
            <select value={turma} onChange={(e) => escolherTurma(e.target.value)}>
              {turmas.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        </div>
        <label>Disciplina
          <select value={dId} onChange={(e) => escolherDisciplina(e.target.value)}>
            {disciplinas.map((d) => <option key={d.id} value={d.id}>{d.nome || 'Sem nome'}</option>)}
          </select>
        </label>
        {!modulos.some((m) => m.anual) && <label>Módulo
          <select value={mId} onChange={(e) => setMId(e.target.value)} disabled={!modulos.length}>
            {!modulos.length && <option value="">Sem módulos</option>}
            {modulos.map((m) => <option key={m.id} value={m.id}>{m.codigo ? `${m.codigo} · ` : ''}{m.nome || 'Sem nome'}</option>)}
          </select>
        </label>}

        <div className="row wrap end">
          {onApagar && <button type="button" className="btn danger" onClick={() => confirm(`Apagar "${t0?.titulo}"?`) && onApagar()}>Apagar</button>}
          <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
          <button type="submit" className="btn primary" disabled={!valido}>Gravar</button>
        </div>
      </form>
    </div>
  );
}

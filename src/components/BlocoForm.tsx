import { useState } from 'react';
import { DIAS_SEMANA } from '../lib/dates';
import { minutos, somarMinutos } from '../lib/horario';
import type { Bloco, Disciplina } from '../lib/types';

interface Props {
  inicial: Bloco;
  novo: boolean;
  disciplinas: Disciplina[];
  /** Horas de início já usadas no horário, para escolher depressa. */
  horas: string[];
  onGravar: (b: Bloco) => void;
  onApagar?: () => void;
  onFechar: () => void;
}

/** Um bloco do horário: aula de uma disciplina ou outra atividade (reunião, apoio, ...). */
export function BlocoForm({ inicial, novo, disciplinas, horas, onGravar, onApagar, onFechar }: Props) {
  const [dId, setDId] = useState(inicial.disciplinaId ?? (inicial.turmas.length ? '' : 'outro'));
  const [titulo, setTitulo] = useState(inicial.turmas.length ? '' : inicial.titulo);
  const [dia, setDia] = useState(inicial.dia);
  const [inicio, setInicio] = useState(inicial.inicio);
  const [fim, setFim] = useState(inicial.fim);
  const [sala, setSala] = useState(inicial.sala ?? '');
  const outro = dId === 'outro';
  const d = disciplinas.find((x) => x.id === dId);
  // Um bloco importado sem ligação direta: mantém título e turmas até se escolher a disciplina.
  const importado = !novo && !inicial.disciplinaId && inicial.turmas.length > 0 && !dId;
  const valido = (outro ? !!titulo.trim() : !!d || importado) && minutos(fim) > minutos(inicio);

  const gravar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valido) return;
    const base = { ...inicial, dia, inicio, fim, sala: sala.trim() || undefined };
    if (outro) onGravar({ ...base, titulo: titulo.trim(), turmas: [], disciplinaId: undefined });
    else if (d) onGravar({ ...base, titulo: d.nome || d.turma, turmas: [d.turma], disciplinaId: d.id });
    else onGravar(base);
  };

  const mudarInicio = (v: string) => {
    // A duração mantém-se ao mudar o início.
    const dur = minutos(fim) - minutos(inicio);
    setInicio(v);
    if (v) setFim(somarMinutos(v, dur > 0 ? dur : 50));
  };

  return (
    <div className="sheet-backdrop center" onClick={onFechar}>
      <form className="dialog bloco-form" role="dialog" aria-modal="true" aria-label={novo ? 'Novo bloco' : 'Editar bloco'} onClick={(e) => e.stopPropagation()} onSubmit={gravar}>
        <h2>{novo ? 'Novo bloco' : 'Editar bloco'}</h2>
        <label>Disciplina
          <select value={dId} onChange={(e) => setDId(e.target.value)} autoFocus={novo}>
            {(novo || importado) && <option value="">{importado ? `${inicial.titulo} (do ficheiro)` : 'Escolher...'}</option>}
            {disciplinas.map((x) => <option key={x.id} value={x.id}>{x.turma} | {x.nome || 'Sem nome'}</option>)}
            <option value="outro">Outra atividade (reunião, apoio, ...)</option>
          </select>
        </label>
        {outro && <label>Nome<input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Reuniões" /></label>}
        <div className="grid-2">
          <label>Dia
            <select value={dia} onChange={(e) => setDia(Number(e.target.value))}>
              {DIAS_SEMANA.slice(0, 6).map((n, i) => <option key={n} value={i}>{n}</option>)}
            </select>
          </label>
          <label>Sala<input value={sala} onChange={(e) => setSala(e.target.value)} placeholder="F103" /></label>
        </div>
        <div className="grid-2">
          <label>Início<input type="time" step={300} value={inicio} list="horas-horario" onChange={(e) => mudarInicio(e.target.value)} /></label>
          <label>Fim<input type="time" step={300} value={fim} onChange={(e) => setFim(e.target.value)} /></label>
        </div>
        <datalist id="horas-horario">{horas.map((h) => <option key={h} value={h} />)}</datalist>
        <div className="row wrap end">
          {onApagar && <button type="button" className="btn danger" onClick={onApagar}>Apagar</button>}
          <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
          <button type="submit" className="btn primary" disabled={!valido}>Gravar</button>
        </div>
      </form>
    </div>
  );
}

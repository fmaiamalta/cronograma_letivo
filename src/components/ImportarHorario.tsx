import { useState } from 'react';
import { DIAS_SEMANA } from '../lib/dates';
import { aulasSemDisciplina, ehAula, importarHorario, lerHorarioICS, nomeTurmas, temposDoHorario } from '../lib/horario';
import { blocosDaPagina } from '../lib/horarioPdf';
import type { Bloco, Estado } from '../lib/types';

interface Props {
  estado: Estado;
  atualizar: (f: (e: Estado) => Estado) => void;
}

interface Pendente {
  blocos: Bloco[];
  origem: string;
  semDisciplina: { titulo: string; turmas: string[] }[];
  criar: Set<number>;
}

function horasDiasTexto(t: number[]): string {
  return t.map((n, i) => (n ? `${DIAS_SEMANA[i]} ${n}` : '')).filter(Boolean).join(' · ');
}

/** Atalho: preenche as aulas das disciplinas a partir do horário da escola (.ics ou PDF). */
export function ImportarHorario({ estado, atualizar }: Props) {
  const [pendente, setPendente] = useState<Pendente | null>(null);
  const [erro, setErro] = useState('');
  const [aLer, setALer] = useState(false);

  const importar = async (f: File) => {
    setErro('');
    let lidos: Bloco[] = [];
    if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
      setALer(true);
      try {
        const { paginasDePDF } = await import('../lib/fileText');
        const paginas = await paginasDePDF(f);
        if (!paginas.some((p) => p.itens.length)) {
          setErro('PDF sem texto (digitalizado). Preencher à mão.');
          return;
        }
        // Um PDF com vários professores: fica a primeira página com horário.
        for (const p of paginas) {
          lidos = blocosDaPagina(p.itens, p.segmentos);
          if (lidos.length) break;
        }
      } catch (e) {
        setErro(`Não foi possível ler o PDF: ${(e as Error).message}`);
        return;
      } finally {
        setALer(false);
      }
    } else {
      lidos = lerHorarioICS(await f.text());
    }
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
    atualizar((e) => importarHorario(e, pendente.blocos, criar));
    setPendente(null);
  };

  return (
    <>
      <label className="btn">
        {aLer ? 'A ler...' : 'Importar horário'}
        <input type="file" accept=".ics,text/calendar,.pdf,application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); e.target.value = ''; }} />
      </label>
      {erro && <p className="warn">{erro}</p>}
      {pendente && (
        <div className="sheet-backdrop center" onClick={() => setPendente(null)}>
          <section className="dialog importar-horario" role="dialog" aria-modal="true" aria-label="Importar horário" onClick={(e) => e.stopPropagation()}>
            <h2>{pendente.origem}</h2>
            <p className="small muted">
              {pendente.blocos.filter(ehAula).length} aulas e {pendente.blocos.filter((b) => !ehAula(b)).length} outras atividades por semana. Substitui as aulas e as atividades que já estão no horário.
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
        </div>
      )}
    </>
  );
}

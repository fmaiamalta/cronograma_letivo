import { useState } from 'react';
import { DISCIPLINAS_ESCOLA } from '../data/disciplinas';
import { COMPONENTES, type Componente, type EntradaCatalogo } from '../lib/types';

export interface Escolha {
  nome: string;
  componente: Componente;
  /** Quando se escolhe uma UC, ela entra logo como primeiro módulo. */
  uc?: EntradaCatalogo;
}

interface Props {
  nome: string;
  componente: Componente;
  catalogo: EntradaCatalogo[];
  onEscolher: (e: Escolha) => void;
}

interface Opcao {
  nome: string;
  detalhe?: string;
  uc?: EntradaCatalogo;
}

function opcoes(componente: Componente, catalogo: EntradaCatalogo[]): { titulo?: string; lista: Opcao[] }[] {
  const disciplinas: Opcao[] = [
    ...catalogo
      .filter((c) => !c.codigo.startsWith('UC') && c.componente === componente)
      .map((c) => ({ nome: c.nome, detalhe: c.horas ? `${c.horas} h` : undefined })),
    ...DISCIPLINAS_ESCOLA.filter((d) => d.componente === componente).map((d) => ({ nome: d.nome })),
  ];
  if (componente !== 'tecnologica') return [{ lista: disciplinas }];
  const ucs = catalogo.filter((c) => c.codigo.startsWith('UC') && c.componente === 'tecnologica');
  const uc = (c: EntradaCatalogo): Opcao => ({ nome: c.nome, detalhe: `${c.codigo} · ${c.horas} h`, uc: c });
  return [
    { titulo: 'Disciplinas', lista: disciplinas },
    { titulo: 'UC obrigatórias', lista: ucs.filter((c) => !c.opcional).map(uc) },
    { titulo: 'UC opcionais', lista: ucs.filter((c) => c.opcional).map(uc) },
  ].filter((g) => g.lista.length);
}

/** Escolha da disciplina em dois passos: componente e depois disciplina ou UC. */
export function DisciplinaPicker({ nome, componente, catalogo, onEscolher }: Props) {
  const [aberto, setAberto] = useState(!nome);
  const [grupo, setGrupo] = useState<Componente | null>(nome ? componente : null);
  const [outra, setOutra] = useState('');
  const compNome = COMPONENTES.find((c) => c.id === componente)?.nome;

  const escolher = (e: Escolha) => {
    onEscolher(e);
    setAberto(false);
    setOutra('');
  };

  if (!aberto) {
    return (
      <button type="button" className="picker-current" onClick={() => setAberto(true)}>
        <span>
          <strong>{nome || 'Escolher disciplina'}</strong>
          {nome && <small>{compNome}</small>}
        </span>
        <span className="chevron">▾</span>
      </button>
    );
  }

  return (
    <div className="picker">
      {COMPONENTES.map((c) => {
        const aberta = grupo === c.id;
        return (
          <div key={c.id} className={'picker-group' + (aberta ? ' open' : '')}>
            <button type="button" className="picker-head" aria-expanded={aberta} onClick={() => setGrupo(aberta ? null : c.id)}>
              <span>{c.nome}</span>
              <span className="chevron">{aberta ? '▴' : '▾'}</span>
            </button>
            {aberta && (
              <div className="picker-body">
                {opcoes(c.id, catalogo).map((g) => (
                  <div key={g.titulo ?? 'lista'}>
                    {g.titulo && <div className="picker-sub">{g.titulo}</div>}
                    <ul>
                      {g.lista.map((o) => (
                        <li key={o.uc?.codigo ?? o.nome}>
                          <button type="button" className={o.nome === nome && !o.uc ? 'sel' : ''}
                            onClick={() => escolher({ nome: o.nome, componente: c.id, uc: o.uc })}>
                            <span>{o.nome}</span>
                            {o.detalhe && <small>{o.detalhe}</small>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <form className="picker-outra" onSubmit={(e) => { e.preventDefault(); if (outra.trim()) escolher({ nome: outra.trim(), componente: c.id }); }}>
                  <input placeholder="Outra disciplina" value={outra} onChange={(e) => setOutra(e.target.value)} aria-label={`Outra disciplina (${c.nome})`} />
                  <button className="btn" type="submit" disabled={!outra.trim()}>OK</button>
                </form>
              </div>
            )}
          </div>
        );
      })}
      {nome && <button type="button" className="link-btn" onClick={() => setAberto(false)}>Cancelar</button>}
    </div>
  );
}

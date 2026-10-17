import { useState } from 'react';
import { DISCIPLINAS_ESCOLA } from '../data/disciplinas';
import { COMPONENTES, type Componente, type EntradaCatalogo } from '../lib/types';

export interface Escolha {
  nome: string;
  componente: Componente;
  /** UC marcadas na componente tecnológica: entram como módulos, por esta ordem. */
  ucs?: EntradaCatalogo[];
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
}

function opcoes(componente: Componente, catalogo: EntradaCatalogo[]): Opcao[] {
  return [
    ...catalogo
      .filter((c) => !c.codigo.startsWith('UC') && c.componente === componente)
      .map((c) => ({ nome: c.nome, detalhe: c.horas ? `${c.horas} h` : undefined })),
    ...DISCIPLINAS_ESCOLA.filter((d) => d.componente === componente).map((d) => ({ nome: d.nome })),
  ];
}

/** Componente tecnológica: nome da disciplina escrito à mão e UC marcadas do referencial. */
function Tecnologica({ nomeAtual, catalogo, onEscolher }: { nomeAtual: string; catalogo: EntradaCatalogo[]; onEscolher: (e: Escolha) => void }) {
  const [nome, setNome] = useState(nomeAtual);
  const [marcadas, setMarcadas] = useState<EntradaCatalogo[]>([]);
  const ucs = catalogo.filter((c) => c.codigo.startsWith('UC') && c.componente === 'tecnologica');
  const alternar = (c: EntradaCatalogo) =>
    setMarcadas((m) => (m.some((x) => x.codigo === c.codigo) ? m.filter((x) => x.codigo !== c.codigo) : [...m, c]));
  const grupos = [
    { titulo: 'UC obrigatórias', lista: ucs.filter((c) => !c.opcional) },
    { titulo: 'UC opcionais', lista: ucs.filter((c) => c.opcional) },
  ].filter((g) => g.lista.length);

  return (
    <form className="picker-tec" onSubmit={(e) => { e.preventDefault(); if (nome.trim()) onEscolher({ nome: nome.trim(), componente: 'tecnologica', ucs: marcadas }); }}>
      <label>Nome da disciplina<input value={nome} placeholder="PPM" onChange={(e) => setNome(e.target.value)} /></label>
      {grupos.map((g) => (
        <div key={g.titulo}>
          <div className="picker-sub">{g.titulo}</div>
          <ul>
            {g.lista.map((c) => {
              const ordem = marcadas.findIndex((x) => x.codigo === c.codigo);
              return (
                <li key={c.codigo}>
                  <label className="picker-uc">
                    <input type="checkbox" checked={ordem >= 0} onChange={() => alternar(c)} />
                    <span>{c.nome}</span>
                    <small>{ordem >= 0 ? `${ordem + 1}.º · ` : ''}{c.codigo.replace(/^UC0*/, '')} · {c.horas} h</small>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div className="picker-tec-foot">
        <span className="muted small">{marcadas.length} UC marcadas</span>
        <button className="btn primary" type="submit" disabled={!nome.trim()}>OK</button>
      </div>
    </form>
  );
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
            {aberta && c.id === 'tecnologica' && (
              <div className="picker-body">
                <Tecnologica nomeAtual={componente === 'tecnologica' ? nome : ''} catalogo={catalogo} onEscolher={escolher} />
              </div>
            )}
            {aberta && c.id !== 'tecnologica' && (
              <div className="picker-body">
                <ul>
                  {opcoes(c.id, catalogo).map((o) => (
                    <li key={o.nome}>
                      <button type="button" className={o.nome === nome ? 'sel' : ''} onClick={() => escolher({ nome: o.nome, componente: c.id })}>
                        <span>{o.nome}</span>
                        {o.detalhe && <small>{o.detalhe}</small>}
                      </button>
                    </li>
                  ))}
                </ul>
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

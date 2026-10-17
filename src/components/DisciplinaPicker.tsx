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

function semAcentos(t: string): string {
  return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Componente tecnológica: nome da disciplina escrito à mão e UC tocadas na lista, por ordem. */
function Tecnologica({ nomeAtual, catalogo, onEscolher }: { nomeAtual: string; catalogo: EntradaCatalogo[]; onEscolher: (e: Escolha) => void }) {
  const [nome, setNome] = useState(nomeAtual);
  const [procura, setProcura] = useState('');
  const [marcadas, setMarcadas] = useState<EntradaCatalogo[]>([]);
  const ucs = catalogo
    .filter((c) => c.codigo.startsWith('UC') && c.componente === 'tecnologica')
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
  const termo = semAcentos(procura.trim());
  const visiveis = termo
    ? ucs.filter((c) => semAcentos(c.codigo).includes(termo.replace(/^uc/, '')) || semAcentos(c.nome).includes(termo))
    : ucs;
  const alternar = (c: EntradaCatalogo) =>
    setMarcadas((m) => (m.some((x) => x.codigo === c.codigo) ? m.filter((x) => x.codigo !== c.codigo) : [...m, c]));

  return (
    <form className="picker-tec" onSubmit={(e) => { e.preventDefault(); if (nome.trim()) onEscolher({ nome: nome.trim(), componente: 'tecnologica', ucs: marcadas }); }}>
      <label>Nome da disciplina<input value={nome} placeholder="PPM" onChange={(e) => setNome(e.target.value)} /></label>
      <input type="search" placeholder="Procurar UC (código ou nome)" value={procura} onChange={(e) => setProcura(e.target.value)} aria-label="Procurar UC" />
      <ul className="uc-list">
        {visiveis.map((c) => {
          const ordem = marcadas.findIndex((x) => x.codigo === c.codigo);
          return (
            <li key={c.codigo}>
              <button type="button" className={'uc-row' + (ordem >= 0 ? ' sel' : '')} aria-pressed={ordem >= 0} onClick={() => alternar(c)}>
                <span className="uc-ordem">{ordem >= 0 ? ordem + 1 : ''}</span>
                <span className="uc-cod mono">{c.codigo}</span>
                <span className="uc-nome">{c.nome}{c.opcional && <span className="tag">opcional</span>}</span>
                <small>{c.horas} h</small>
              </button>
            </li>
          );
        })}
        {!visiveis.length && <li className="muted small uc-vazio">Sem resultados.</li>}
      </ul>
      <div className="picker-tec-foot">
        <span className="muted small">{marcadas.length ? marcadas.map((m) => m.codigo).join(', ') : 'Nenhuma UC escolhida'}</span>
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

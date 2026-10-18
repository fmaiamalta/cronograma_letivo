import { useState } from 'react';
import { DISCIPLINAS_BASICO, DISCIPLINAS_ESCOLA, DISCIPLINAS_SECUNDARIO } from '../data/disciplinas';
import { codigoVisivel, ehDisciplina, ehUC } from '../lib/catalog';
import { COMPONENTES, type Ano, type Componente, type EntradaCatalogo, type Ensino } from '../lib/types';

export interface Escolha {
  nome: string;
  componente: Componente;
  /** UC marcadas na componente tecnológica: entram como módulos, por esta ordem. */
  ucs?: EntradaCatalogo[];
}

interface Props {
  nome: string;
  componente: Componente;
  ensino: Ensino;
  ano: Ano;
  catalogo: EntradaCatalogo[];
  onEscolher: (e: Escolha) => void;
}

interface Opcao {
  nome: string;
  detalhe?: string;
  grupo?: string;
}

function opcoes(componente: Componente, catalogo: EntradaCatalogo[], ensino: Ensino, ano: Ano): Opcao[] {
  if (ensino !== 'profissional') {
    const lista = ensino === 'basico' ? DISCIPLINAS_BASICO : DISCIPLINAS_SECUNDARIO;
    return lista.filter((d) => d.componente === componente && d.anos.includes(ano)).map((d) => ({ nome: d.nome, grupo: d.grupo }));
  }
  return [
    ...catalogo
      .filter((c) => ehDisciplina(c) && c.componente === componente)
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
    .filter((c) => ehUC(c) && c.componente === 'tecnologica')
    // UC por código; módulos sem código no fim, por nome.
    .sort((a, b) => (a.modulo ? 1 : 0) - (b.modulo ? 1 : 0) || (a.modulo ? a.nome.localeCompare(b.nome) : a.codigo.localeCompare(b.codigo)));
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
                {/* O Safari não aplica flex/grid ao próprio <button>: o alinhamento vive neste span. */}
                <span className="uc-line">
                  <span className="uc-ordem">{ordem >= 0 ? ordem + 1 : ''}</span>
                  <span className="uc-cod">{codigoVisivel(c)}</span>
                  <span className="uc-nome">
                    {c.nome}
                    {c.opcional && <span className="tag">opcional</span>}
                  </span>
                  <span className="uc-horas">{c.horas} h</span>
                </span>
              </button>
            </li>
          );
        })}
        {!visiveis.length && <li className="muted small uc-vazio">Sem resultados.</li>}
      </ul>
      <div className="picker-tec-foot">
        <span className="muted small">{marcadas.length ? marcadas.map((m) => codigoVisivel(m) || m.nome).join(', ') : 'Nenhuma UC escolhida'}</span>
        <button className="btn primary" type="submit" disabled={!nome.trim()}>OK</button>
      </div>
    </form>
  );
}

/** Escolha da disciplina em dois passos: componente e depois disciplina ou UC. */
export function DisciplinaPicker({ nome, componente, ensino, ano, catalogo, onEscolher }: Props) {
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
        <span className="opt-line">
          <span className="picker-current-txt">
            <strong>{nome || 'Escolher disciplina'}</strong>
            {nome && <small>{compNome}</small>}
          </span>
          <span className="chevron">▾</span>
        </span>
      </button>
    );
  }

  return (
    <div className="picker">
      {COMPONENTES.filter((c) => c.ensino === ensino).map((c) => {
        const aberta = grupo === c.id;
        return (
          <div key={c.id} className={'picker-group' + (aberta ? ' open' : '')}>
            <button type="button" className="picker-head" aria-expanded={aberta} onClick={() => setGrupo(aberta ? null : c.id)}>
              <span className="opt-line">
                <span>{c.nome}</span>
                <span className="chevron">{aberta ? '▴' : '▾'}</span>
              </span>
            </button>
            {aberta && c.id === 'tecnologica' && (
              <div className="picker-body">
                <Tecnologica nomeAtual={componente === 'tecnologica' ? nome : ''} catalogo={catalogo} onEscolher={escolher} />
              </div>
            )}
            {aberta && c.id !== 'tecnologica' && (
              <div className="picker-body">
                <ul>
                  {opcoes(c.id, catalogo, ensino, ano).map((o, i, l) => (
                    <li key={o.nome}>
                      {o.grupo && o.grupo !== l[i - 1]?.grupo && <div className="picker-sub">{o.grupo}</div>}
                      <button type="button" className={o.nome === nome ? 'sel' : ''} onClick={() => escolher({ nome: o.nome, componente: c.id })}>
                        <span className="opt-line">
                          <span>{o.nome}</span>
                          {o.detalhe && <small>{o.detalhe}</small>}
                        </span>
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

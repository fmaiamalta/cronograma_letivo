import { useState } from 'react';
import { codigoVisivel, juntarCatalogo, lerCatalogoCSV, lerReferencial, normalizarCodigo, pesquisarCatalogo } from '../lib/catalog';
import { horasParaTempos } from '../lib/engine';
import { lerFicheiro } from '../lib/fileText';
import { CATALOGO_BASE } from '../lib/presets';
import { COMPONENTES, type Componente, type EntradaCatalogo, type Estado } from '../lib/types';
import { IconEdit, IconTrash } from './icons';

interface Props {
  estado: Estado;
  atualizar: (f: (e: Estado) => Estado) => void;
}

export function CatalogoView({ estado, atualizar }: Props) {
  const [termo, setTermo] = useState('');
  const [aLer, setALer] = useState<string | null>(null);
  const [novas, setNovas] = useState<EntradaCatalogo[] | null>(null);
  const [form, setForm] = useState({ codigo: '', nome: '', horas: '25', componente: 'tecnologica' as Componente });
  const lista = pesquisarCatalogo(estado.catalogo, termo, 500);
  // Tempos com os minutos do profissional (o campo do cronograma), se escolhidos.
  const mpt = estado.minutosProfissional ?? estado.calendario.minutosPorTempo;
  // Entrada a ser editada na tabela (pelo código original).
  const [aEditar, setAEditar] = useState<{ original: string; codigo: string; nome: string; horas: string; componente: Componente } | null>(null);
  const [erroEdicao, setErroEdicao] = useState('');

  const gravarEdicao = () => {
    if (!aEditar) return;
    const horas = Number(aEditar.horas.replace(',', '.'));
    // Módulos sem código (criados à mão) guardam o código interno.
    const codigo = aEditar.codigo.trim() ? normalizarCodigo(aEditar.codigo) : aEditar.original;
    if (!aEditar.nome.trim() || !(horas > 0)) { setErroEdicao('Nome e horas são obrigatórios.'); return; }
    if (codigo !== aEditar.original && estado.catalogo.some((x) => x.codigo === codigo)) { setErroEdicao(`Já existe ${codigo} no catálogo.`); return; }
    atualizar((s) => ({
      ...s,
      catalogo: s.catalogo.map((x) => (x.codigo === aEditar.original ? { ...x, codigo, nome: aEditar.nome.trim(), horas, componente: aEditar.componente } : x)),
    }));
    setAEditar(null);
    setErroEdicao('');
  };

  const importar = async (file: File) => {
    setALer('A ler o ficheiro...');
    try {
      const { texto } = await lerFicheiro(file, setALer);
      const nome = file.name.toLowerCase();
      let r = nome.endsWith('.csv') ? lerCatalogoCSV(texto) : lerReferencial(texto);
      if (!r.length) r = lerCatalogoCSV(texto);
      if (!r.length) alert('Sem UC reconhecidas neste ficheiro. Formatos aceites: referencial (PDF ou DOCX) ou CSV "código;nome;horas".');
      else setNovas(r);
    } catch (err) {
      alert(`Não foi possível ler o ficheiro: ${(err as Error).message}`);
    } finally {
      setALer(null);
    }
  };

  const adicionar = (e: React.FormEvent) => {
    e.preventDefault();
    const horas = Number(form.horas.replace(',', '.'));
    if (!form.codigo.trim() || !form.nome.trim() || !(horas > 0)) return;
    atualizar((s) => ({
      ...s,
      catalogo: juntarCatalogo(s.catalogo, [{ codigo: normalizarCodigo(form.codigo), nome: form.nome.trim(), horas, componente: form.componente }]),
    }));
    setForm({ ...form, codigo: '', nome: '' });
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Catálogo de UC</h1>
          <p className="muted">{estado.catalogo.length} entradas. Inclui o referencial de Técnico/a de Multimédia.</p>
        </div>
        <label className="btn primary">
          {aLer ?? 'Importar referencial'}
          <input type="file" hidden accept=".pdf,.docx,.csv,.txt" disabled={!!aLer}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importar(f); }} />
        </label>
      </div>

      {novas && (
        <section className="card plain highlight">
          <h2>Encontrei {novas.length} entradas</h2>
          <p className="muted small">
            {novas.filter((n) => n.codigo.startsWith('UC')).length} UC e {novas.filter((n) => !n.codigo.startsWith('UC')).length} disciplinas. 2,25 pontos de crédito = 25 h.
          </p>
          <div className="table-wrap small-table">
            <table>
              <tbody>
                {novas.slice(0, 8).map((n) => (
                  <tr key={n.codigo}><td>{n.codigo}</td><td>{n.nome}</td><td>{n.horas} h</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {novas.length > 8 && <p className="muted small">e mais {novas.length - 8}.</p>}
          <div className="row">
            <button className="btn primary" onClick={() => { atualizar((s) => ({ ...s, catalogo: juntarCatalogo(s.catalogo, novas) })); setNovas(null); }}>Juntar ao catálogo</button>
            <button className="btn" onClick={() => setNovas(null)}>Cancelar</button>
          </div>
        </section>
      )}

      <form className="card plain grid-form" onSubmit={adicionar}>
        <label>Código<input value={form.codigo} placeholder="UC02634" onChange={(e) => setForm({ ...form, codigo: e.target.value })} /></label>
        <label className="span2">Nome<input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></label>
        <label>Horas<input value={form.horas} inputMode="decimal" onChange={(e) => setForm({ ...form, horas: e.target.value })} /></label>
        <label>Componente
          <select value={form.componente} onChange={(e) => setForm({ ...form, componente: e.target.value as Componente })}>
            {COMPONENTES.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <button className="btn" type="submit">Adicionar</button>
      </form>

      <input className="search" type="search" placeholder="Procurar por código ou nome" value={termo} onChange={(e) => setTermo(e.target.value)} />

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Código</th><th>Nome</th><th>Horas</th><th>Tempos</th><th>Componente</th><th /></tr>
          </thead>
          <tbody>
            {lista.map((e) => aEditar?.original === e.codigo ? (
              <tr key={e.codigo} className="a-editar">
                <td><input className="mono" value={aEditar.codigo} placeholder="sem código" onChange={(x) => setAEditar({ ...aEditar, codigo: x.target.value })} aria-label="Código" /></td>
                <td><input value={aEditar.nome} onChange={(x) => setAEditar({ ...aEditar, nome: x.target.value })} aria-label="Nome" autoFocus />{erroEdicao && <small className="warn">{erroEdicao}</small>}</td>
                <td><input value={aEditar.horas} inputMode="decimal" onChange={(x) => setAEditar({ ...aEditar, horas: x.target.value })} aria-label="Horas" /></td>
                <td>{Number(aEditar.horas.replace(',', '.')) > 0 ? horasParaTempos(Number(aEditar.horas.replace(',', '.')), mpt) : '—'}</td>
                <td>
                  <select value={aEditar.componente} onChange={(x) => setAEditar({ ...aEditar, componente: x.target.value as Componente })} aria-label="Componente">
                    {COMPONENTES.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </td>
                <td className="acoes">
                  <button className="btn primary small-btn" onClick={gravarEdicao}>Gravar</button>
                  <button className="btn small-btn" onClick={() => { setAEditar(null); setErroEdicao(''); }}>Cancelar</button>
                </td>
              </tr>
            ) : (
              <tr key={e.codigo}>
                <td className="mono">{codigoVisivel(e)}</td>
                <td>{e.nome}{e.opcional && <span className="tag">opcional</span>}</td>
                <td>{e.horas}</td>
                <td>{horasParaTempos(e.horas, mpt)}</td>
                <td>{COMPONENTES.find((c) => c.id === e.componente)?.nome}</td>
                <td className="acoes">
                  <button className="icon-btn" aria-label={`Editar ${e.codigo}`}
                    onClick={() => { setErroEdicao(''); setAEditar({ original: e.codigo, codigo: codigoVisivel(e), nome: e.nome, horas: String(e.horas).replace('.', ','), componente: e.componente }); }}><IconEdit /></button>
                  <button className="icon-btn" aria-label={`Apagar ${e.codigo}`}
                    onClick={() => atualizar((s) => ({ ...s, catalogo: s.catalogo.filter((x) => x.codigo !== e.codigo) }))}><IconTrash /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="row end">
        <button className="btn" onClick={() => confirm('Repor o catálogo original? As entradas importadas são removidas.') && atualizar((s) => ({ ...s, catalogo: CATALOGO_BASE }))}>
          Repor catálogo original
        </button>
      </div>
    </div>
  );
}

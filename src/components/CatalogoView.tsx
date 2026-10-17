import { useState } from 'react';
import { juntarCatalogo, lerCatalogoCSV, lerReferencial, normalizarCodigo, pesquisarCatalogo } from '../lib/catalog';
import { horasParaTempos } from '../lib/engine';
import { lerFicheiro } from '../lib/fileText';
import { CATALOGO_BASE } from '../lib/presets';
import { COMPONENTES, type Componente, type EntradaCatalogo, type Estado } from '../lib/types';
import { IconTrash } from './icons';

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
  const mpt = estado.calendario.minutosPorTempo;

  const importar = async (file: File) => {
    setALer('A ler o ficheiro...');
    try {
      const { texto } = await lerFicheiro(file, setALer);
      const nome = file.name.toLowerCase();
      let r = nome.endsWith('.csv') ? lerCatalogoCSV(texto) : lerReferencial(texto);
      if (!r.length) r = lerCatalogoCSV(texto);
      if (!r.length) alert('Não encontrei UC neste ficheiro. Usa o referencial da qualificação (PDF ou DOCX) ou um CSV "código;nome;horas".');
      else setNovas(r);
    } catch (err) {
      alert(`Não consegui ler o ficheiro: ${(err as Error).message}`);
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
          <p className="muted">
            {estado.catalogo.length} entradas. Vem com o referencial de Técnico/a de Multimédia. Para outro curso, importa o referencial
            desse curso (Word ou PDF).
          </p>
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
            {novas.filter((n) => n.codigo.startsWith('UC')).length} UC e {novas.filter((n) => !n.codigo.startsWith('UC')).length} disciplinas.
            As horas das UC vêm dos pontos de crédito (2,25 pontos = 25 h).
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
            {lista.map((e) => (
              <tr key={e.codigo}>
                <td className="mono">{e.codigo}</td>
                <td>{e.nome}{e.opcional && <span className="tag">opcional</span>}</td>
                <td>{e.horas}</td>
                <td>{horasParaTempos(e.horas, mpt)}</td>
                <td>{COMPONENTES.find((c) => c.id === e.componente)?.nome}</td>
                <td>
                  <button className="icon-btn" aria-label={`Apagar ${e.codigo}`}
                    onClick={() => atualizar((s) => ({ ...s, catalogo: s.catalogo.filter((x) => x.codigo !== e.codigo) }))}><IconTrash /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="row end">
        <button className="btn" onClick={() => confirm('Repor o catálogo original? As entradas importadas desaparecem.') && atualizar((s) => ({ ...s, catalogo: CATALOGO_BASE }))}>
          Repor catálogo original
        </button>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { lerCalendario, type SugestaoCalendario } from '../lib/calendarParse';
import { fmtLong, uid, weekday, DIAS_SEMANA } from '../lib/dates';
import { lerFicheiro } from '../lib/fileText';
import { calendario2026 } from '../lib/presets';
import { linkCalendario } from '../lib/store';
import { ANOS, type Ano, type CalendarioEscolar, type Ensino, type Estado, type Feriado, type Periodo } from '../lib/types';
import { IconTrash } from './icons';

interface Props {
  estado: Estado;
  atualizar: (f: (e: Estado) => Estado) => void;
}

/** "21 Setembro - Secundário" e "15 Setembro - Pré-Escolar, 1º, 2º e 3º Ciclo" dão o início de cada nível. */
function iniciosPorNivel(inicios: { data: string; nota: string }[]): Partial<Record<Ensino, string>> {
  const out: Partial<Record<Ensino, string>> = {};
  for (const i of inicios) {
    if (/secund/i.test(i.nota)) out.secundario = i.data;
    else if (/ciclo|b[aá]sico/i.test(i.nota)) out.basico = i.data;
  }
  return out;
}

export function CalendarioView({ estado, atualizar }: Props) {
  const cal = estado.calendario;
  const [aLer, setALer] = useState<string | null>(null);
  const [sugestao, setSugestao] = useState<
    (SugestaoCalendario & { escolhidas: Set<string>; ficheiro: string; inicioEscolhido?: string; substituir: boolean }) | null
  >(null);
  const [copiado, setCopiado] = useState(false);

  const setCal = (f: (c: CalendarioEscolar) => CalendarioEscolar) => atualizar((e) => ({ ...e, calendario: f(e.calendario) }));
  const set = <K extends keyof CalendarioEscolar>(k: K, v: CalendarioEscolar[K]) => setCal((c) => ({ ...c, [k]: v }));

  const mudarInterrupcao = (id: string, f: (p: Periodo) => Periodo | null) =>
    setCal((c) => ({ ...c, interrupcoes: c.interrupcoes.map((p) => (p.id === id ? f(p) : p)).filter(Boolean) as Periodo[] }));
  const mudarFeriado = (id: string, f: (p: Feriado) => Feriado | null) =>
    setCal((c) => ({ ...c, feriados: (c.feriados.map((p) => (p.id === id ? f(p) : p)).filter(Boolean) as Feriado[]) }));

  const anoInicial = Number(cal.anoLetivo.slice(0, 4)) || Number(cal.inicio.slice(0, 4));

  const importar = async (file: File) => {
    setALer('A ler o ficheiro...');
    try {
      const { texto, itens } = await lerFicheiro(file, setALer);
      const s = lerCalendario(texto, anoInicial, itens);
      const anos = Object.keys(s.fimPorAno);
      const chaves = [
        ...anos.map((a) => `fim:${a}`),
        ...s.interrupcoes.map((i) => `i:${i.inicio}`),
        ...s.feriados.map((f) => `f:${f.data}`),
      ];
      if (!chaves.length && !s.inicio) alert('Sem datas reconhecidas neste ficheiro.');
      else setSugestao({ ...s, escolhidas: new Set(chaves), ficheiro: file.name, inicioEscolhido: s.inicio, substituir: true });
    } catch (err) {
      alert(`Não foi possível ler o ficheiro: ${(err as Error).message}`);
    } finally {
      setALer(null);
    }
  };

  const aplicar = () => {
    if (!sugestao) return;
    const e = sugestao.escolhidas;
    const novasInt = sugestao.interrupcoes.filter((n) => e.has(`i:${n.inicio}`)).map((n) => ({ id: uid(), ...n }));
    const novosFer = sugestao.feriados.filter((n) => e.has(`f:${n.data}`)).map((n) => ({ id: uid(), ...n }));
    const fimPorAno = { ...cal.fimPorAno };
    for (const [ano, data] of Object.entries(sugestao.fimPorAno)) if (e.has(`fim:${ano}`) && data) fimPorAno[Number(ano) as Ano] = data;
    setCal((c) => ({
      ...c,
      inicio: sugestao.inicioEscolhido ?? c.inicio,
      inicioPorEnsino: { ...c.inicioPorEnsino, ...iniciosPorNivel(sugestao.inicios) },
      fimPorAno,
      importadoDe: sugestao.ficheiro,
      // O calendário é de cada escola: por defeito o ficheiro substitui o que lá estava.
      interrupcoes: (sugestao.substituir
        ? novasInt
        : [...c.interrupcoes.filter((i) => !novasInt.some((n) => n.nome === i.nome)), ...novasInt]
      ).sort((a, b) => a.inicio.localeCompare(b.inicio)),
      feriados: (sugestao.substituir
        ? novosFer
        : [...c.feriados.filter((f) => !novosFer.some((n) => n.data === f.data)), ...novosFer]
      ).sort((a, b) => a.data.localeCompare(b.data)),
    }));
    setSugestao(null);
  };

  const alternar = (k: string) =>
    setSugestao((s) => {
      if (!s) return s;
      const n = new Set(s.escolhidas);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return { ...s, escolhidas: n };
    });

  const partilhar = async () => {
    const url = linkCalendario(cal);
    try {
      if (navigator.share) await navigator.share({ title: `Calendário escolar ${cal.anoLetivo}`, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2500);
      }
    } catch {
      prompt('Link de partilha:', url);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Calendário escolar</h1>
          <p className="muted">Interrupções, feriados, início e fim das aulas da escola.</p>
        </div>
        <div className="row wrap">
          <label className="btn">
            {aLer ?? 'Importar PDF ou imagem'}
            <input type="file" hidden accept=".pdf,.docx,.txt,image/*" disabled={!!aLer}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importar(f); }} />
          </label>
          <button className="btn" onClick={partilhar}>{copiado ? 'Link copiado' : 'Partilhar com colegas'}</button>
        </div>
      </div>

      {!cal.importadoDe && !sugestao && (
        <section className="card plain highlight">
          <strong>Calendário nacional 2026/2027.</strong>
          <p className="muted small">Falta importar o calendário da escola (PDF, Word ou imagem).</p>
        </section>
      )}
      {cal.importadoDe && !sugestao && <p className="muted small">Importado de: {cal.importadoDe}</p>}

      {sugestao && (
        <section className="card plain highlight">
          <h2>Datas encontradas no ficheiro</h2>
          <p className="muted small">Só as datas marcadas são gravadas.</p>
          {(sugestao.inicios.length > 1 || sugestao.inicio) && (
            <fieldset>
              <legend>Início das aulas</legend>
              {sugestao.inicios.length > 1 && <p className="muted small">Mais do que um início no ficheiro.</p>}
              <ul className="check-list">
                {(sugestao.inicios.length ? sugestao.inicios : [{ data: sugestao.inicio!, nota: '' }]).map((x) => (
                  <li key={x.data}>
                    <label>
                      <input type="radio" name="inicio" checked={sugestao.inicioEscolhido === x.data}
                        onChange={() => setSugestao((s) => s && { ...s, inicioEscolhido: x.data })} />
                      {fmtLong(x.data)} ({DIAS_SEMANA[weekday(x.data)]}){x.nota ? ` · ${x.nota}` : ''}
                    </label>
                  </li>
                ))}
                <li>
                  <label>
                    <input type="radio" name="inicio" checked={sugestao.inicioEscolhido === undefined}
                      onChange={() => setSugestao((s) => s && { ...s, inicioEscolhido: undefined })} />
                    Manter {fmtLong(cal.inicio)}
                  </label>
                </li>
              </ul>
            </fieldset>
          )}
          <ul className="check-list">
            {ANOS.filter((a) => sugestao.fimPorAno[a]).map((a) => (
              <li key={a}><label><input type="checkbox" checked={sugestao.escolhidas.has(`fim:${a}`)} onChange={() => alternar(`fim:${a}`)} /> Fim das aulas do {a}.º ano: {fmtLong(sugestao.fimPorAno[a]!)}</label></li>
            ))}
            {sugestao.interrupcoes.map((i) => (
              <li key={i.inicio}><label><input type="checkbox" checked={sugestao.escolhidas.has(`i:${i.inicio}`)} onChange={() => alternar(`i:${i.inicio}`)} /> Interrupção {i.nome}: {fmtLong(i.inicio)} a {fmtLong(i.fim)}</label></li>
            ))}
            {sugestao.feriados.map((f) => (
              <li key={f.data}><label><input type="checkbox" checked={sugestao.escolhidas.has(`f:${f.data}`)} onChange={() => alternar(`f:${f.data}`)} /> {f.nome}: {fmtLong(f.data)}</label></li>
            ))}
          </ul>
          <label className="toggle">
            <input type="checkbox" checked={sugestao.substituir} onChange={(e) => setSugestao((s) => s && { ...s, substituir: e.target.checked })} />
            Substituir todas as interrupções e feriados atuais pelos do ficheiro
          </label>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn primary" onClick={aplicar}>Gravar as marcadas</button>
            <button className="btn" onClick={() => setSugestao(null)}>Cancelar</button>
          </div>
        </section>
      )}

      <section className="card plain">
        <div className="grid-form">
          <label>Ano letivo<input value={cal.anoLetivo} onChange={(e) => set('anoLetivo', e.target.value)} /></label>
          <label>Escola<input value={cal.escola} placeholder="Nome da escola" onChange={(e) => set('escola', e.target.value)} /></label>
          <label>Duração de um tempo (min)<input type="number" min={30} max={120} value={cal.minutosPorTempo} onChange={(e) => set('minutosPorTempo', Number(e.target.value) || 50)} /></label>
          <label>Início das aulas (profissional)<input type="date" value={cal.inicio} onChange={(e) => e.target.value && set('inicio', e.target.value)} /></label>
          <label>Início no básico
            <input type="date" value={cal.inicioPorEnsino?.basico ?? ''} onChange={(e) => set('inicioPorEnsino', { ...cal.inicioPorEnsino, basico: e.target.value || undefined })} />
          </label>
          <label>Início no secundário
            <input type="date" value={cal.inicioPorEnsino?.secundario ?? ''} onChange={(e) => set('inicioPorEnsino', { ...cal.inicioPorEnsino, secundario: e.target.value || undefined })} />
          </label>
          {ANOS.map((a) => (
            <label key={a}>Fim das aulas {a}.º ano
              <input type="date" value={cal.fimPorAno[a]} onChange={(e) => e.target.value && set('fimPorAno', { ...cal.fimPorAno, [a]: e.target.value })} />
            </label>
          ))}
        </div>
      </section>

      <section className="card plain">
        <h2>Interrupções letivas</h2>
        {cal.interrupcoes.map((p) => (
          <div key={p.id} className="period-row">
            <input value={p.nome} onChange={(e) => mudarInterrupcao(p.id, (x) => ({ ...x, nome: e.target.value }))} aria-label="Nome" />
            <input type="date" value={p.inicio} onChange={(e) => mudarInterrupcao(p.id, (x) => ({ ...x, inicio: e.target.value }))} aria-label="Início" />
            <input type="date" value={p.fim} onChange={(e) => mudarInterrupcao(p.id, (x) => ({ ...x, fim: e.target.value }))} aria-label="Fim" />
            <button className="icon-btn" onClick={() => mudarInterrupcao(p.id, () => null)} aria-label={`Apagar ${p.nome}`}><IconTrash /></button>
          </div>
        ))}
        <button className="btn" onClick={() => setCal((c) => ({ ...c, interrupcoes: [...c.interrupcoes, { id: uid(), nome: 'Interrupção', inicio: c.inicio, fim: c.inicio }] }))}>+ Interrupção</button>
      </section>

      <section className="card plain">
        <h2>Feriados e dias sem atividade letiva</h2>
        <p className="muted small">Inclui o feriado municipal.</p>
        {cal.feriados.map((f) => (
          <div key={f.id} className="period-row">
            <input value={f.nome} onChange={(e) => mudarFeriado(f.id, (x) => ({ ...x, nome: e.target.value }))} aria-label="Nome" />
            <input type="date" value={f.data} onChange={(e) => mudarFeriado(f.id, (x) => ({ ...x, data: e.target.value }))} aria-label="Data" />
            <span className="muted small">{f.data ? DIAS_SEMANA[weekday(f.data)] : ''}</span>
            <button className="icon-btn" onClick={() => mudarFeriado(f.id, () => null)} aria-label={`Apagar ${f.nome}`}><IconTrash /></button>
          </div>
        ))}
        <button className="btn" onClick={() => setCal((c) => ({ ...c, feriados: [...c.feriados, { id: uid(), nome: 'Feriado municipal', data: c.inicio }] }))}>+ Feriado</button>
      </section>

      <div className="row end">
        <button className="btn" onClick={() => {
          if (confirm('Repor o calendário nacional 2026/2027? As alterações perdem-se.')) {
            atualizar((e) => ({ ...e, calendario: { ...calendario2026(), escola: e.calendario.escola } }));
          }
        }}>
          Repor calendário 2026/2027
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { gistDoTexto } from '../lib/sync';
import { codificar, descodificar, linkDados } from '../lib/transfer';
import type { Estado } from '../lib/types';

type Pacote = NonNullable<Awaited<ReturnType<typeof descodificar>>>;

export function EnviarDialog({ estado, onFechar }: { estado: Estado; onFechar: () => void }) {
  const [link, setLink] = useState('');
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    codificar(estado).then((c) => setLink(linkDados(c)));
  }, [estado]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      prompt('Link:', link);
    }
  };
  const partilhar = async () => {
    try {
      await navigator.share({ title: 'Cronograma Letivo', url: link });
    } catch {
      // Partilha cancelada.
    }
  };

  return (
    <div className="sheet-backdrop center" onClick={onFechar}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Enviar para o telemóvel" onClick={(e) => e.stopPropagation()}>
        <h2>Enviar para o telemóvel</h2>
        <ol className="passos">
          <li>Copiar o link (ou partilhar por mensagem, e-mail ou AirDrop).</li>
          <li>No telemóvel, abrir a app: menu ⋯ › Receber do computador › Colar.</li>
        </ol>
        <textarea className="codigo" readOnly value={link} rows={3} onFocus={(e) => e.target.select()} aria-label="Link com os dados" />
        <p className="muted small">{link ? `${Math.round(link.length / 100) / 10} mil caracteres` : 'A preparar...'} · horário, calendário e tarefas</p>
        <div className="row wrap end">
          {'share' in navigator && <button className="btn" onClick={partilhar} disabled={!link}>Partilhar</button>}
          <button className="btn primary" onClick={copiar} disabled={!link}>{copiado ? 'Copiado' : 'Copiar link'}</button>
          <button className="btn" onClick={onFechar}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

export function ReceberDialog({ inicial = '', onAplicar, onLigarSync, onFechar }: {
  inicial?: string;
  onAplicar: (p: Pacote) => void;
  onLigarSync: (gistId: string) => void;
  onFechar: () => void;
}) {
  const [texto, setTexto] = useState(inicial);
  const [pacote, setPacote] = useState<Pacote | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;
    if (!texto.trim()) {
      setPacote(null);
      setErro(false);
      return;
    }
    descodificar(texto).then((p) => {
      if (!vivo) return;
      setPacote(p);
      setErro(!p);
    });
    return () => {
      vivo = false;
    };
  }, [texto]);

  const colar = async () => {
    try {
      setTexto(await navigator.clipboard.readText());
    } catch {
      // Sem acesso à área de transferência: colar à mão no campo.
    }
  };

  const gist = gistDoTexto(texto);
  const nModulos = pacote?.disciplinas.reduce((s, d) => s + d.modulos.length, 0) ?? 0;

  return (
    <div className="sheet-backdrop center" onClick={onFechar}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Receber do computador" onClick={(e) => e.stopPropagation()}>
        <h2>Receber do computador</h2>
        <textarea className="codigo" rows={3} placeholder="Colar aqui o link" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Link com os dados" />
        {pacote && (
          <p className="small">
            {pacote.disciplinas.length} disciplinas · {nModulos} módulos · calendário {pacote.calendario.anoLetivo}
          </p>
        )}
        {gist && <p className="small">Link de sincronização automática.</p>}
        {erro && !gist && <p className="warn small">Link inválido ou incompleto.</p>}
        <p className="muted small">Substitui o horário, o calendário e as tarefas deste aparelho. Tarefas já feitas aqui ficam feitas.</p>
        <div className="row wrap end">
          <button className="btn" onClick={colar}>Colar</button>
          {gist ? (
            <button className="btn primary" onClick={() => onLigarSync(gist)}>Ligar</button>
          ) : (
            <button className="btn primary" disabled={!pacote} onClick={() => pacote && onAplicar(pacote)}>Receber</button>
          )}
          <button className="btn" onClick={onFechar}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

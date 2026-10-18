import { useState } from 'react';
import { linkSync, URL_NOVA_CHAVE, type ConfigSync } from '../lib/sync';

function quando(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

interface Props {
  sync: ConfigSync;
  onLigar: (token: string) => Promise<void>;
  onDesligar: () => void;
  onFechar: () => void;
}

/** Computador: ligar a sincronização automática para o telemóvel. */
export function SyncDialog({ sync, onLigar, onDesligar, onFechar }: Props) {
  const [token, setToken] = useState('');
  const [aLigar, setALigar] = useState(false);
  const [erro, setErro] = useState('');
  const [copiado, setCopiado] = useState(false);
  const ligado = !!(sync.token && sync.gistId);
  const link = sync.gistId ? linkSync(sync.gistId) : '';

  const ligar = async (e: React.FormEvent) => {
    e.preventDefault();
    setALigar(true);
    setErro('');
    try {
      await onLigar(token.trim());
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setALigar(false);
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      prompt('Link:', link);
    }
  };

  return (
    <div className="sheet-backdrop center" onClick={onFechar}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Sincronizar com o telemóvel" onClick={(e) => e.stopPropagation()}>
        <h2>Sincronizar com o telemóvel</h2>
        {!ligado ? (
          <form onSubmit={ligar} className="dialog-form">
            <ol className="passos">
              <li>
                Criar uma chave no GitHub: <a href={URL_NOVA_CHAVE} target="_blank" rel="noreferrer">abrir página</a>. Em "Expiration", escolher
                "No expiration" e carregar em "Generate token".
              </li>
              <li>Copiar a chave (começa por ghp_) e colar aqui.</li>
            </ol>
            <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="ghp_..." autoComplete="off" spellCheck={false} aria-label="Chave do GitHub" />
            {erro && <p className="warn small">{erro}</p>}
            <p className="muted small">A chave só dá acesso a gists e fica guardada apenas neste computador.</p>
            <div className="row wrap end">
              <button className="btn primary" type="submit" disabled={!token.trim() || aLigar}>{aLigar ? 'A ligar...' : 'Ligar'}</button>
              <button className="btn" type="button" onClick={onFechar}>Fechar</button>
            </div>
          </form>
        ) : (
          <>
            <p className={sync.erro ? 'warn small' : 'small'}>
              {sync.erro ? sync.erro : `Ligado. Última atualização: ${quando(sync.ultimo)}.`}
            </p>
            <ol className="passos">
              <li>Copiar o link e fazê-lo chegar ao telemóvel (mensagem, e-mail, AirDrop).</li>
              <li>No telemóvel, na app: menu ⋯ › Receber do computador › Colar › Ligar. Só é preciso uma vez.</li>
            </ol>
            <textarea className="codigo" readOnly rows={2} value={link} onFocus={(e) => e.target.select()} aria-label="Link para o telemóvel" />
            <div className="row wrap end">
              <button className="btn danger" onClick={() => confirm('Desligar a sincronização neste computador?') && onDesligar()}>Desligar</button>
              {'share' in navigator && (
                <button className="btn" onClick={() => navigator.share({ title: 'Cronograma Letivo', url: link }).catch(() => undefined)}>Partilhar</button>
              )}
              <button className="btn primary" onClick={copiar}>{copiado ? 'Copiado' : 'Copiar link'}</button>
              <button className="btn" onClick={onFechar}>Fechar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

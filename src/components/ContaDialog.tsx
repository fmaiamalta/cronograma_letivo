import { useState } from 'react';
import { confirmarCodigo, pedirCodigo } from '../lib/nuvem';

function quando(iso?: string): string {
  return iso ? new Date(iso).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
}

interface Props {
  email: string | null;
  info: { ultimo?: string; erro?: string };
  onEntrou: () => Promise<void>;
  onSair: () => void;
  onSincronizar: () => void;
  onFechar: () => void;
}

/** Entrar com o e-mail (código de 6 dígitos) para ter os dados em todos os aparelhos. */
export function ContaDialog({ email, info, onEntrou, onSair, onSincronizar, onFechar }: Props) {
  const [endereco, setEndereco] = useState('');
  const [codigo, setCodigo] = useState('');
  const [passo, setPasso] = useState<'email' | 'codigo'>('email');
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState('');

  const executar = async (f: () => Promise<void>) => {
    setAGuardar(true);
    setErro('');
    try {
      await f();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setAGuardar(false);
    }
  };

  return (
    <div className="sheet-backdrop center" onClick={onFechar}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Conta" onClick={(e) => e.stopPropagation()}>
        <h2>Conta</h2>
        {email ? (
          <>
            <p className="small">Entrada feita com <strong>{email}</strong>.</p>
            <p className={info.erro ? 'warn small' : 'muted small'}>
              {info.erro ? info.erro : info.ultimo ? `Sincronizado: ${quando(info.ultimo)}.` : 'A sincronizar...'}
            </p>
            <p className="muted small">Os mesmos dados em todos os aparelhos com este e-mail.</p>
            <div className="row wrap end">
              <button className="btn danger" onClick={() => confirm('Sair da conta neste aparelho? Os dados ficam guardados na conta.') && onSair()}>Sair</button>
              <button className="btn" onClick={onSincronizar}>Sincronizar agora</button>
              <button className="btn primary" onClick={onFechar}>Fechar</button>
            </div>
          </>
        ) : passo === 'email' ? (
          <form className="dialog-form" onSubmit={(e) => { e.preventDefault(); executar(async () => { await pedirCodigo(endereco.trim()); setPasso('codigo'); }); }}>
            <p className="muted small">Para ter os mesmos dados no computador e no telemóvel.</p>
            <input type="email" autoComplete="email" inputMode="email" placeholder="nome@escola.pt" value={endereco} onChange={(e) => setEndereco(e.target.value)} aria-label="E-mail" autoFocus />
            {erro && <p className="warn small">{erro}</p>}
            <div className="row wrap end">
              <button className="btn" type="button" onClick={onFechar}>Fechar</button>
              <button className="btn primary" type="submit" disabled={!/\S+@\S+\.\S+/.test(endereco) || aGuardar}>{aGuardar ? 'A enviar...' : 'Enviar código'}</button>
            </div>
          </form>
        ) : (
          <form className="dialog-form" onSubmit={(e) => { e.preventDefault(); executar(async () => { await confirmarCodigo(endereco.trim(), codigo); await onEntrou(); }); }}>
            <p className="small">Código enviado para <strong>{endereco}</strong>. Pode demorar um minuto; ver também o spam.</p>
            <input inputMode="numeric" autoComplete="one-time-code" placeholder="123456" value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} aria-label="Código" autoFocus maxLength={10} />
            {erro && <p className="warn small">{erro}</p>}
            <div className="row wrap end">
              <button className="btn" type="button" onClick={() => { setPasso('email'); setCodigo(''); setErro(''); }}>Outro e-mail</button>
              <button className="btn primary" type="submit" disabled={codigo.length < 6 || aGuardar}>{aGuardar ? 'A entrar...' : 'Entrar'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { emailAtual, fundir, gravar, ler, nuvemConfigurada, sair } from './nuvem';
import type { Estado } from './types';

const CHAVE_LOCAL = 'cronograma.nuvem';

interface Memoria {
  /** Versão (data) da conta que este aparelho conhece. */
  versao?: string;
  /** Impressão digital do último estado igual ao da conta. */
  assinatura?: string;
}

function lerMemoria(): Memoria {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_LOCAL) ?? '{}') as Memoria;
  } catch {
    return {};
  }
}
function gravarMemoria(m: Memoria) {
  try {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify(m));
  } catch {
    // Sem armazenamento: volta a sincronizar ao abrir.
  }
}

/** JSON com as chaves ordenadas: a base de dados devolve-as noutra ordem. */
function canonico(v: unknown): string {
  return JSON.stringify(v, (_k, x) =>
    x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x,
  );
}

function assinatura(e: Estado): string {
  const s = canonico(e);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${s.length}:${h >>> 0}`;
}

/**
 * Mantém o estado igual ao da conta: grava 2 s depois de cada alteração e vai
 * buscar ao abrir, ao voltar à app e de 2 em 2 minutos. Se outro aparelho
 * gravou entretanto, junta as duas versões antes de gravar.
 */
export function useNuvem(estado: Estado, setEstado: (e: Estado) => void) {
  const [email, setEmail] = useState<string | null>(null);
  const [info, setInfo] = useState<{ ultimo?: string; erro?: string; aSincronizar?: boolean }>({});
  const mem = useRef<Memoria>(lerMemoria());
  const estadoRef = useRef(estado);
  estadoRef.current = estado;
  const ocupado = useRef(false);

  const marcar = (versao: string | undefined, e: Estado) => {
    mem.current = { versao, assinatura: assinatura(e) };
    gravarMemoria(mem.current);
    setInfo({ ultimo: new Date().toISOString() });
  };

  const puxar = useCallback(async () => {
    const r = await ler();
    if (!r) return false;
    if (r.atualizado !== mem.current.versao) {
      const novo = fundir(estadoRef.current, r.dados);
      // Fica marcado como igual à conta; se a junção mudou algo (tarefas feitas aqui), grava a seguir.
      mem.current = { versao: r.atualizado, assinatura: assinatura(r.dados) };
      gravarMemoria(mem.current);
      setEstado(novo);
    }
    setInfo({ ultimo: new Date().toISOString() });
    return true;
  }, [setEstado]);

  const empurrar = useCallback(async () => {
    const e = estadoRef.current;
    if (assinatura(e) === mem.current.assinatura) return;
    const r = await gravar(e, mem.current.versao);
    if (r === 'conflito') {
      // Outro aparelho gravou: junta e volta a tentar na próxima volta.
      mem.current.assinatura = undefined;
      await puxar();
      return;
    }
    marcar(r, e);
  }, [puxar]);

  const sincronizar = useCallback(async () => {
    if (ocupado.current) return;
    ocupado.current = true;
    try {
      const sujo = assinatura(estadoRef.current) !== mem.current.assinatura;
      if (sujo) await empurrar();
      else await puxar();
    } catch (err) {
      setInfo((i) => ({ ...i, erro: (err as Error).message }));
    } finally {
      ocupado.current = false;
    }
  }, [empurrar, puxar]);

  /** Depois de entrar: se a conta já tem dados, valem esses; senão, sobe os deste aparelho. */
  const aposEntrar = useCallback(async () => {
    const em = await emailAtual();
    setEmail(em);
    const r = await ler();
    if (r && r.dados.disciplinas?.length) {
      mem.current = { versao: r.atualizado, assinatura: assinatura(r.dados) };
      setEstado(fundir(estadoRef.current, r.dados));
    } else {
      const v = await gravar(estadoRef.current, r?.atualizado);
      if (v !== 'conflito') marcar(v, estadoRef.current);
    }
    gravarMemoria(mem.current);
    setInfo({ ultimo: new Date().toISOString() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setEstado]);

  const terminar = useCallback(async () => {
    await sair();
    mem.current = {};
    gravarMemoria({});
    setEmail(null);
    setInfo({});
  }, []);

  // Sessão guardada de uma vez anterior.
  useEffect(() => {
    if (nuvemConfigurada) emailAtual().then(setEmail).catch(() => undefined);
  }, []);

  // Grava 2 s depois da última alteração.
  useEffect(() => {
    if (!email) return;
    const t = setTimeout(sincronizar, 2000);
    return () => clearTimeout(t);
  }, [estado, email, sincronizar]);

  // Vai buscar ao abrir, ao voltar à app e de 2 em 2 minutos.
  useEffect(() => {
    if (!email) return;
    sincronizar();
    const aoVoltar = () => document.visibilityState === 'visible' && sincronizar();
    document.addEventListener('visibilitychange', aoVoltar);
    const t = setInterval(sincronizar, 2 * 60_000);
    return () => {
      document.removeEventListener('visibilitychange', aoVoltar);
      clearInterval(t);
    };
  }, [email, sincronizar]);

  return { email, info, aposEntrar, terminar, sincronizar };
}

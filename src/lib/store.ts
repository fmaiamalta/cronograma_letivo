import { useCallback, useEffect, useState } from 'react';
import { estadoInicial } from './presets';
import { migrarDiasSemAula, type CalendarioEscolar, type Estado } from './types';

const CHAVE = 'cronograma.v1';

export function carregar(): Estado {
  try {
    const raw = localStorage.getItem(CHAVE);
    if (raw) {
      const e = JSON.parse(raw) as Estado;
      if (e?.versao === 1 && e.calendario && Array.isArray(e.disciplinas)) {
        return migrarDiasSemAula({ ...estadoInicial(), ...e });
      }
    }
  } catch {
    // Armazenamento bloqueado (janela privada) ou dados corrompidos.
  }
  return estadoInicial();
}

export function gravar(e: Estado): boolean {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(e));
    return true;
  } catch {
    return false;
  }
}

export function useEstado() {
  const [estado, setEstado] = useState<Estado>(carregar);
  const [gravado, setGravado] = useState(true);
  useEffect(() => {
    setGravado(gravar(estado));
  }, [estado]);
  const atualizar = useCallback((f: (e: Estado) => Estado) => setEstado((e) => f(e)), []);
  return { estado, atualizar, setEstado, gravado };
}

export function validarEstado(x: unknown): Estado | null {
  const e = x as Estado;
  if (!e || e.versao !== 1 || !e.calendario || !Array.isArray(e.disciplinas)) return null;
  return migrarDiasSemAula({ ...estadoInicial(), ...e });
}

// Partilha do calendário escolar por link: o JSON vai no fragmento (#cal=...),
// que nunca chega ao servidor.
function b64urlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function linkCalendario(cal: CalendarioEscolar, base = location.href.split('#')[0]): string {
  return `${base}#cal=${b64urlEncode(JSON.stringify(cal))}`;
}

export function calendarioDoLink(hash: string): CalendarioEscolar | null {
  const m = hash.match(/#cal=([\w-]+)/);
  if (!m) return null;
  try {
    const c = JSON.parse(b64urlDecode(m[1])) as CalendarioEscolar;
    if (c && c.inicio && c.fimPorAno && Array.isArray(c.interrupcoes) && Array.isArray(c.feriados)) return c;
  } catch {
    // Link estragado.
  }
  return null;
}

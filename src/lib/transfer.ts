import type { Estado } from './types';

// Passagem de dados do computador para o telemóvel, sem servidor: o horário,
// o calendário e as tarefas vão comprimidos num código (ou num link #dados=...).

type Pacote = Pick<Estado, 'calendario' | 'disciplinas' | 'periodosTurma' | 'ausencias'>;

function b64url(bytes: Uint8Array): string {
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function deB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function transformar(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

const temCompressao = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

/** "CL1." = comprimido (deflate-raw); "CL0." = só base64, para browsers antigos. */
export async function codificar(e: Estado): Promise<string> {
  const pacote: Pacote = { calendario: e.calendario, disciplinas: e.disciplinas, periodosTurma: e.periodosTurma, ausencias: e.ausencias ?? [] };
  const bytes = new TextEncoder().encode(JSON.stringify(pacote));
  if (temCompressao()) return 'CL1.' + b64url(await transformar(bytes, new CompressionStream('deflate-raw')));
  return 'CL0.' + b64url(bytes);
}

/** Aceita o código sozinho ou um link com #dados=. */
export async function descodificar(texto: string): Promise<Pacote | null> {
  const m = texto.trim().match(/(CL[01])\.([A-Za-z0-9_-]+)/);
  if (!m) return null;
  try {
    let bytes = deB64url(m[2]);
    if (m[1] === 'CL1') {
      if (!temCompressao()) return null;
      bytes = await transformar(bytes, new DecompressionStream('deflate-raw'));
    }
    const p = JSON.parse(new TextDecoder().decode(bytes)) as Pacote;
    if (!p?.calendario || !Array.isArray(p.disciplinas)) return null;
    return { calendario: p.calendario, disciplinas: p.disciplinas, periodosTurma: p.periodosTurma ?? [], ausencias: p.ausencias };
  } catch {
    return null;
  }
}

export function linkDados(codigo: string, base = location.href.split('#')[0]): string {
  return `${base}#dados=${codigo}`;
}

/**
 * Aplica os dados recebidos. O catálogo fica o do aparelho. Uma tarefa já
 * marcada como feita neste aparelho continua feita.
 */
export function aplicarPacote(local: Estado, p: Pacote): Estado {
  const feitas = new Set(local.disciplinas.flatMap((d) => d.modulos.flatMap((m) => m.tarefas.filter((t) => t.feita).map((t) => t.id))));
  return {
    ...local,
    calendario: p.calendario,
    periodosTurma: p.periodosTurma,
    // Um código antigo não traz faltas: ficam as do aparelho.
    ausencias: p.ausencias ?? local.ausencias,
    disciplinas: p.disciplinas.map((d) => ({
      ...d,
      modulos: d.modulos.map((m) => ({ ...m, tarefas: m.tarefas.map((t) => (feitas.has(t.id) ? { ...t, feita: true } : t)) })),
    })),
  };
}

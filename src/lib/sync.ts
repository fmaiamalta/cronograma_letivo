// Sincronização num só sentido, do computador para o telemóvel, através de um
// Gist secreto do GitHub. O computador (com a chave) escreve; o telemóvel (só
// com o identificador do Gist) lê. O conteúdo é o mesmo código do envio manual.

const API = 'https://api.github.com';
const FICHEIRO = 'cronograma-letivo.txt';
const CHAVE = 'cronograma.sync';

export interface ConfigSync {
  /** Só no computador: chave do GitHub com permissão "gist". */
  token?: string;
  gistId?: string;
  /** Data/hora ISO da última atualização bem-sucedida. */
  ultimo?: string;
  etag?: string;
  erro?: string;
}

export function lerSync(): ConfigSync {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) ?? '{}') as ConfigSync;
  } catch {
    return {};
  }
}

export function gravarSync(c: ConfigSync): ConfigSync {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(c));
  } catch {
    // Sem armazenamento: dura só esta sessão.
  }
  return c;
}

/** Página do GitHub para criar a chave, já com a permissão "gist" marcada. */
export const URL_NOVA_CHAVE = 'https://github.com/settings/tokens/new?scopes=gist&description=Cronograma%20Letivo';

function erroHttp(r: Response): Error {
  if (r.status === 401) return new Error('Chave do GitHub inválida ou expirada.');
  if (r.status === 403 || r.status === 429) return new Error('O GitHub recusou o pedido (limite de pedidos). Nova tentativa mais tarde.');
  if (r.status === 404) return new Error('Sincronização não encontrada no GitHub.');
  return new Error(`Erro do GitHub (${r.status}).`);
}

/** Cria (primeira vez) ou atualiza o Gist. Devolve o identificador do Gist. */
export async function publicar(token: string, gistId: string | undefined, codigo: string, f: typeof fetch = fetch): Promise<string> {
  const corpo = { description: 'Cronograma Letivo (sincronização)', files: { [FICHEIRO]: { content: codigo } } };
  const r = await f(gistId ? `${API}/gists/${gistId}` : `${API}/gists`, {
    method: gistId ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify(gistId ? corpo : { ...corpo, public: false }),
  });
  if (!r.ok) throw erroHttp(r);
  return ((await r.json()) as { id: string }).id;
}

/** Lê o Gist. Sem alterações desde a última leitura (ETag), devolve { naoMudou: true }. */
export async function obter(
  gistId: string,
  etag?: string,
  f: typeof fetch = fetch,
): Promise<{ codigo?: string; etag?: string; naoMudou?: boolean }> {
  const r = await f(`${API}/gists/${gistId}`, {
    headers: { Accept: 'application/vnd.github+json', ...(etag ? { 'If-None-Match': etag } : {}) },
    cache: 'no-store',
  });
  if (r.status === 304) return { naoMudou: true, etag };
  if (!r.ok) throw erroHttp(r);
  const g = (await r.json()) as { files: Record<string, { content?: string; truncated?: boolean; raw_url?: string }> };
  const fich = g.files[FICHEIRO];
  if (!fich) throw new Error('Sincronização sem dados.');
  const codigo = fich.truncated && fich.raw_url ? await (await f(fich.raw_url, { cache: 'no-store' })).text() : fich.content;
  return { codigo, etag: r.headers.get('ETag') ?? undefined };
}

export function linkSync(gistId: string, base = location.href.split('#')[0]): string {
  return `${base}#sync=${gistId}`;
}

/** Extrai o identificador do Gist de um link "#sync=...". */
export function gistDoTexto(texto: string): string | null {
  return texto.match(/sync=([0-9a-f]{20,40})/i)?.[1] ?? null;
}

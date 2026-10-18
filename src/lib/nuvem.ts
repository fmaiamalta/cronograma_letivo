import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NUVEM } from './nuvem.config';
import { aplicarPacote } from './transfer';
import type { Estado } from './types';

// Sincronização por conta (e-mail): uma linha por professor na tabela
// "cronogramas", com o estado inteiro em JSON e a data da última gravação.

const URL_NUVEM: string = import.meta.env.VITE_SUPABASE_URL || NUVEM.url;
const CHAVE: string = import.meta.env.VITE_SUPABASE_ANON_KEY || NUVEM.anonKey;

export const nuvemConfigurada = !!(URL_NUVEM && CHAVE);

let cliente: SupabaseClient | null = null;
function nuvem(): SupabaseClient {
  cliente ??= createClient(URL_NUVEM, CHAVE, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  return cliente;
}

function erro(e: { message?: string; status?: number } | null): Error {
  const m = e?.message ?? '';
  if (/rate limit|too many/i.test(m)) return new Error('Demasiados pedidos. Tentar de novo daqui a alguns minutos.');
  if (/expired|invalid/i.test(m)) return new Error('Código errado ou expirado.');
  if (/not authorized/i.test(m)) return new Error('O servidor de e-mail ainda não está configurado para este endereço.');
  if (/fetch|network/i.test(m)) return new Error('Sem ligação à internet.');
  return new Error(m || 'Erro no servidor.');
}

export async function emailAtual(): Promise<string | null> {
  if (!nuvemConfigurada) return null;
  const { data } = await nuvem().auth.getSession();
  return data.session?.user.email ?? null;
}

export async function pedirCodigo(email: string): Promise<void> {
  const { error } = await nuvem().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw erro(error);
}

export async function confirmarCodigo(email: string, codigo: string): Promise<void> {
  const { error } = await nuvem().auth.verifyOtp({ email, token: codigo.trim(), type: 'email' });
  if (error) throw erro(error);
}

export async function sair(): Promise<void> {
  await nuvem().auth.signOut();
}

export interface Remoto {
  dados: Estado;
  atualizado: string;
}

export async function ler(): Promise<Remoto | null> {
  const { data, error } = await nuvem().from('cronogramas').select('dados, atualizado').maybeSingle();
  if (error) throw erro(error);
  return (data as Remoto | null) ?? null;
}

/**
 * Grava o estado. Com "anterior" (a versão que este aparelho conhece), só
 * grava se ninguém tiver gravado entretanto; senão devolve "conflito".
 */
export async function gravar(e: Estado, anterior: string | undefined): Promise<string | 'conflito'> {
  const { data: s } = await nuvem().auth.getSession();
  const userId = s.session?.user.id;
  if (!userId) throw new Error('Sessão terminada. Entrar outra vez.');
  const atualizado = new Date().toISOString();
  const q = anterior
    ? nuvem().from('cronogramas').update({ dados: e, atualizado }).eq('user_id', userId).eq('atualizado', anterior)
    : nuvem().from('cronogramas').upsert({ user_id: userId, dados: e, atualizado });
  const { data, error } = await q.select('atualizado');
  if (error) throw erro(error);
  if (!data?.length) return 'conflito';
  return (data[0] as { atualizado: string }).atualizado;
}

/**
 * Junta o que veio da conta com o deste aparelho: vale o da conta, mas uma
 * tarefa marcada como feita aqui continua feita.
 */
export function fundir(local: Estado, remoto: Estado): Estado {
  return { ...local, ...remoto, disciplinas: aplicarPacote(local, remoto).disciplinas };
}

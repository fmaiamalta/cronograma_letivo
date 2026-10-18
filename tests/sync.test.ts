import { describe, expect, it, vi } from 'vitest';
import { gistDoTexto, linkSync, obter, publicar } from '../src/lib/sync';

const resposta = (status: number, corpo?: unknown, headers: Record<string, string> = {}) =>
  new Response(corpo === undefined ? null : JSON.stringify(corpo), { status, headers });

describe('sincronização por Gist', () => {
  it('cria o Gist secreto na primeira vez e depois atualiza o mesmo', async () => {
    const f = vi.fn().mockResolvedValue(resposta(201, { id: 'abc123abc123abc123abc123' }));
    expect(await publicar('tok', undefined, 'CL1.x', f)).toBe('abc123abc123abc123abc123');
    const [url, opts] = f.mock.calls[0];
    expect(url).toBe('https://api.github.com/gists');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body).public).toBe(false);
    expect(opts.headers.Authorization).toBe('Bearer tok');

    f.mockResolvedValue(resposta(200, { id: 'abc123abc123abc123abc123' }));
    await publicar('tok', 'abc123abc123abc123abc123', 'CL1.y', f);
    expect(f.mock.calls[1][0]).toBe('https://api.github.com/gists/abc123abc123abc123abc123');
    expect(f.mock.calls[1][1].method).toBe('PATCH');
  });

  it('lê o conteúdo e usa o ETag para não descarregar o que não mudou', async () => {
    const f = vi.fn().mockResolvedValue(resposta(200, { files: { 'cronograma-letivo.txt': { content: 'CL1.z' } } }, { ETag: 'W/"1"' }));
    expect(await obter('g1', undefined, f)).toEqual({ codigo: 'CL1.z', etag: 'W/"1"' });
    f.mockResolvedValue(resposta(304));
    expect(await obter('g1', 'W/"1"', f)).toEqual({ naoMudou: true, etag: 'W/"1"' });
    expect(f.mock.calls[1][1].headers['If-None-Match']).toBe('W/"1"');
  });

  it('mensagem clara com chave inválida', async () => {
    const f = vi.fn().mockResolvedValue(resposta(401, { message: 'Bad credentials' }));
    await expect(publicar('mau', undefined, 'x', f)).rejects.toThrow('Chave do GitHub inválida');
  });

  it('link do telemóvel', () => {
    const l = linkSync('0123456789abcdef0123', 'https://x.pt/app/');
    expect(l).toBe('https://x.pt/app/#sync=0123456789abcdef0123');
    expect(gistDoTexto(l)).toBe('0123456789abcdef0123');
    expect(gistDoTexto('nada')).toBeNull();
  });
});

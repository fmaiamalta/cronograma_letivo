import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { entradaParaModulo, juntarCatalogo, lerCatalogoCSV, lerReferencial, normalizarCodigo, pesquisarCatalogo, pontosParaHoras, procurarCodigo } from '../src/lib/catalog';
import { CATALOGO_BASE } from '../src/lib/presets';

describe('códigos', () => {
  it('normaliza formas curtas', () => {
    expect(normalizarCodigo('2640')).toBe('UC02640');
    expect(normalizarCodigo(' uc 2640 ')).toBe('UC02640');
    expect(normalizarCodigo('UC02640')).toBe('UC02640');
    expect(normalizarCodigo('dacp0012s00')).toBe('DACP0012S00');
  });
  it('reconhece o nome a partir do código', () => {
    expect(procurarCodigo(CATALOGO_BASE, '2634')?.nome).toBe('Criar páginas para a web em hipertexto');
    expect(procurarCodigo(CATALOGO_BASE, 'UC02640')?.horas).toBe(25);
    expect(procurarCodigo(CATALOGO_BASE, 'UC99999')).toBeUndefined();
  });
  it('pesquisa sem acentos', () => {
    expect(pesquisarCatalogo(CATALOGO_BASE, 'animacoes').length).toBeGreaterThan(2);
  });
});

describe('pontos de crédito', () => {
  it('2,25 pontos = 25 h e 4,5 = 50 h', () => {
    expect(pontosParaHoras(2.25)).toBe(25);
    expect(pontosParaHoras(4.5)).toBe(50);
  });
});

describe('lerReferencial', () => {
  const texto = readFileSync(new URL('./fixtures/referencial-multimedia.txt', import.meta.url), 'utf8');
  const r = lerReferencial(texto);
  const ucs = r.filter((e) => e.codigo.startsWith('UC'));

  it('encontra as 25 UC obrigatórias e as 29 opcionais', () => {
    expect(ucs.filter((e) => !e.opcional)).toHaveLength(25);
    expect(ucs.filter((e) => e.opcional)).toHaveLength(29);
  });
  it('completa nomes partidos por linhas', () => {
    expect(r.find((e) => e.codigo === 'UC02629')?.nome).toBe('Instalar e configurar sistemas operativos para ambientes em rede');
  });
  it('lê disciplinas com horas e ignora células coladas', () => {
    expect(r.find((e) => e.codigo === 'DACP0012S00')).toMatchObject({ nome: 'Tecnologias da Informação e Comunicação', horas: 100, componente: 'sociocultural' });
    expect(r.find((e) => e.codigo === 'DACP0032C20')).toMatchObject({ horas: 200, componente: 'cientifica' });
    expect(r.every((e) => e.nome.length <= 100)).toBe(true);
  });
});

describe('CSV', () => {
  it('lê ; e ignora cabeçalho', () => {
    const r = lerCatalogoCSV('codigo;nome;horas;componente\n2634;HTML;25;tecnológica\nUC02651;CSS;25h\n');
    expect(r).toEqual([
      { codigo: 'UC02634', nome: 'HTML', horas: 25, componente: 'tecnologica' },
      { codigo: 'UC02651', nome: 'CSS', horas: 25, componente: 'tecnologica' },
    ]);
  });
  it('juntar substitui pelo código', () => {
    const j = juntarCatalogo([{ codigo: 'UC1', nome: 'a', horas: 1, componente: 'tecnologica' }], [{ codigo: 'UC1', nome: 'b', horas: 2, componente: 'tecnologica' }]);
    expect(j).toHaveLength(1);
    expect(j[0].nome).toBe('b');
  });
});

describe('módulos escritos à mão entram no catálogo', () => {
  const base = [{ codigo: 'UC02640', nome: 'Gerir um projeto multimédia', horas: 25, componente: 'tecnologica' as const }];
  it('UC nova com código', () => {
    expect(entradaParaModulo(base, { codigo: '2700', nome: 'Nova UC', quantidade: 25, unidade: 'h' }, 'tecnologica', 50)).toEqual({
      codigo: 'UC02700', nome: 'Nova UC', horas: 25, componente: 'tecnologica', manual: true,
    });
  });
  it('módulo sem código, em tempos', () => {
    expect(entradaParaModulo(base, { nome: 'Base 1 · Pesquisar', quantidade: 60, unidade: 't' }, 'sociocultural', 50)).toEqual({
      codigo: 'MOD:base 1 · pesquisar', nome: 'Base 1 · Pesquisar', horas: 50, componente: 'sociocultural', modulo: true, manual: true,
    });
  });
  it('atualiza a duração de um módulo criado à mão', () => {
    const cat = [{ codigo: 'MOD:base 3', nome: 'Base 3', horas: 25, componente: 'sociocultural' as const, modulo: true, manual: true }];
    expect(entradaParaModulo(cat, { nome: 'Base 3', quantidade: 40, unidade: 'h' }, 'sociocultural', 50)?.horas).toBe(40);
    expect(entradaParaModulo(cat, { nome: 'Base 3', quantidade: 25, unidade: 'h' }, 'sociocultural', 50)).toBeNull();
  });
  it('não repete o que já existe nem guarda módulos incompletos', () => {
    expect(entradaParaModulo(base, { codigo: 'UC02640', nome: 'x', quantidade: 25, unidade: 'h' }, 'tecnologica', 50)).toBeNull();
    expect(entradaParaModulo(base, { nome: 'Gerir um projeto multimedia', quantidade: 25, unidade: 'h' }, 'tecnologica', 50)).toBeNull();
    expect(entradaParaModulo(base, { nome: '', quantidade: 25, unidade: 'h' }, 'tecnologica', 50)).toBeNull();
    expect(entradaParaModulo(base, { nome: 'Algo', quantidade: 0, unidade: 'h' }, 'tecnologica', 50)).toBeNull();
  });
});

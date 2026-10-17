import { describe, expect, it } from 'vitest';
import { lerCalendario } from '../src/lib/calendarParse';
import { calendarioDoLink, linkCalendario } from '../src/lib/store';
import { calendario2026 } from '../src/lib/presets';

describe('lerCalendario', () => {
  it('lê a legenda do cronograma da escola', () => {
    const s = lerCalendario('Interrupções: Natal 16/12–31/12 | Carnaval 08/02–10/02 | Páscoa 22/03–02/04', 2026);
    expect(s.interrupcoes).toEqual([
      { nome: 'Natal', inicio: '2026-12-16', fim: '2026-12-31' },
      { nome: 'Carnaval', inicio: '2027-02-08', fim: '2027-02-10' },
      { nome: 'Páscoa', inicio: '2027-03-22', fim: '2027-04-02' },
    ]);
  });

  it('lê datas por extenso e feriados', () => {
    const texto = [
      'Interrupção do Natal: de 16 de dezembro de 2026 a 31 de dezembro de 2026',
      '1.º período: 15/09/2026 a 15/12/2026',
      'Feriado municipal - 13 de junho',
      '05/10/2026 Implantação da República (feriado)',
    ].join('\n');
    const s = lerCalendario(texto, 2026);
    expect(s.interrupcoes).toEqual([{ nome: 'Natal', inicio: '2026-12-16', fim: '2026-12-31' }]);
    expect(s.inicio).toBe('2026-09-15');
    expect(s.feriados).toEqual([
      { nome: 'Implantação da República', data: '2026-10-05' },
      { nome: 'Feriado municipal', data: '2027-06-13' },
    ]);
  });

  it('ignora datas impossíveis', () => {
    expect(lerCalendario('Natal 31/02–35/02', 2026).interrupcoes).toEqual([]);
  });
});

describe('link de partilha', () => {
  it('ida e volta com acentos', () => {
    const cal = { ...calendario2026(), escola: 'Escola Secundária de São João' };
    const url = linkCalendario(cal, 'https://exemplo.pt/cronograma/');
    const volta = calendarioDoLink(url.slice(url.indexOf('#')));
    expect(volta).toEqual(cal);
  });
  it('rejeita lixo', () => {
    expect(calendarioDoLink('#cal=abc')).toBeNull();
    expect(calendarioDoLink('#outra')).toBeNull();
  });
});

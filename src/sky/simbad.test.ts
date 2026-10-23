import { describe, expect, it } from 'vitest';
import { parseLiterature } from './simbad';

describe('SIMBAD literature check', () => {
  it('reads a known object', () => {
    expect(parseLiterature('main_id,nbref,otype\n"LS  II +14   13",77,"SB?"\n')).toEqual({
      known: true,
      name: 'LS II +14 13',
      papers: 77,
      type: 'SB?',
    });
  });

  it('treats an empty result as never written about', () => {
    expect(parseLiterature('main_id,nbref,otype\n')).toEqual({ known: false });
  });
});

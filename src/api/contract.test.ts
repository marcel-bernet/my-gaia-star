import { describe, expect, it } from 'vitest';
import { BadResponse, coneRequest, MAX_STARS, parseCone, parseLiteratureResponse, parseStarById } from './contract';

const star = {
  id: '4295806720',
  ra: 44.99,
  dec: 0.003,
  g: 17.6,
  bpRp: 1.2,
  plx: 0.5,
  plxErr: 0.1,
  pmRa: 1,
  pmDec: -2,
  rv: null,
  teff: null,
};

describe('API contract: requests', () => {
  it('sends only position and depth, normalised', () => {
    expect(coneRequest(-10.1234567891, 41.5, 'faint')).toEqual({ ra: 349.876543, dec: 41.5, depth: 'faint' });
  });

  it('refuses positions off the sky and depths the server does not serve', () => {
    expect(() => coneRequest(0, 91, 'all')).toThrow(RangeError);
    expect(() => coneRequest(NaN, 0, 'all')).toThrow(RangeError);
    expect(() => coneRequest(0, 0, 'naked-eye')).toThrow(RangeError);
  });
});

describe('API contract: answers are untrusted', () => {
  it('reads a cone', () => {
    expect(parseCone({ stars: [star] })).toEqual([star]);
  });

  it('refuses ids sent as numbers, which lose digits', () => {
    expect(() => parseCone({ stars: [{ ...star, id: 4295806720 }] })).toThrow(BadResponse);
    expect(() => parseCone({ stars: [{ ...star, id: '42<script>' }] })).toThrow(BadResponse);
  });

  it('refuses values off the sky, non-numbers and oversized answers', () => {
    expect(() => parseCone({ stars: [{ ...star, dec: 120 }] })).toThrow(BadResponse);
    expect(() => parseCone({ stars: [{ ...star, g: '17' }] })).toThrow(BadResponse);
    expect(() => parseCone({ stars: Array(MAX_STARS + 1).fill(star) })).toThrow(BadResponse);
  });

  it('refuses an answer about a different star', () => {
    expect(parseStarById({ star }, star.id)).toEqual(star);
    expect(parseStarById({ star: null }, star.id)).toBeNull();
    expect(() => parseStarById({ star }, '1')).toThrow(BadResponse);
  });

  it('bounds and cleans literature text', () => {
    expect(parseLiteratureResponse({ known: false, name: 'ignored' })).toEqual({ known: false });
    expect(parseLiteratureResponse({ known: true, name: 'HD\u0000 1', papers: 3.4, type: '' })).toEqual({
      known: true,
      name: 'HD  1',
      papers: 3,
      type: null,
    });
    expect(() => parseLiteratureResponse({ known: true, name: 'x'.repeat(201), papers: 1 })).toThrow(BadResponse);
  });
});

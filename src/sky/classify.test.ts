import { describe, expect, it } from 'vitest';
import { classify, mainSequenceMag } from './classify';

// Absolute magnitude M at 10 pc: parallax 100 mas, so G = M.
const at10pc = (g: number, bpRp: number | null, teff: number | null = null) => ({ g, bpRp, plx: 100, plxErr: 0.1, teff });

describe('classify', () => {
  it('puts the Sun on the main sequence as a yellow dwarf about 1 R☉', () => {
    expect(mainSequenceMag(0.82)).toBeCloseTo(4.67, 2);
    const c = classify(at10pc(4.67, 0.82, 5772))!;
    expect(c.kind).toBe('yellow-dwarf');
    expect(c.radiusSun).toBeCloseTo(1, 1);
  });

  it('recognises the classic types', () => {
    expect(classify(at10pc(11, 2.8))!.kind).toBe('red-dwarf'); // Proxima-like M dwarf
    expect(classify(at10pc(6.5, 1.2))!.kind).toBe('orange-dwarf');
    expect(classify(at10pc(12, 0.2))!.kind).toBe('white-dwarf');
    expect(classify(at10pc(0.5, 1.2))!.kind).toBe('red-giant'); // red clump
    expect(classify(at10pc(-5, 1.8))!.kind).toBe('supergiant');
    expect(classify(at10pc(-2.5, -0.1))!.kind).toBe('blue-giant');
    expect(classify(at10pc(2.8, 0.85))!.kind).toBe('subgiant');
  });

  it('falls back to colour alone without a reliable distance', () => {
    const c = classify({ g: 19, bpRp: 2.4, plx: 0.1, plxErr: 0.3, teff: null })!;
    expect(c).toEqual({ kind: 'red-star', radiusSun: null, sure: false });
  });

  it('gives a red giant a big radius', () => {
    expect(classify(at10pc(-0.5, 1.5, 4300))!.radiusSun).toBeGreaterThan(10);
  });
});

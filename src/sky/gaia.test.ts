import { describe, expect, it } from 'vitest';
import { parseCsv, parseTsv, radiusFor } from './gaia';

describe('parsers', () => {
  it('keeps full Gaia IDs from TAP CSV', () => {
    const rows = parseCsv('source_id,ra,dec,phot_g_mean_mag,bp_rp\n4057701830728920065,266.1,-29.2,5.1,\n');
    expect(rows[0].source_id).toBe('4057701830728920065');
    expect(rows[0].bp_rp).toBe('');
  });
  it('skips comments, units and dashes in ASU TSV', () => {
    const tsv = '#c\n\n_r\tSource\tGmag\narcsec\t \tmag\n---\t---\t---\n 0.1\t4057481992811289728\t17.3\n';
    expect(parseTsv(tsv)).toEqual([{ _r: ' 0.1', Source: '4057481992811289728', Gmag: '17.3' }]);
  });
});

describe('radiusFor', () => {
  it('keeps the probe when it already has enough', () => {
    expect(radiusFor(0.25, 400, 400, 1.5)).toBe(0.25);
  });
  it('grows with the square root of the shortfall, capped', () => {
    expect(radiusFor(0.25, 100, 400, 1.5)).toBeCloseTo(0.575, 3);
    expect(radiusFor(0.25, 0, 400, 1.5)).toBe(1.5);
  });
});

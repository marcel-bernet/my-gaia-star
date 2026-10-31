import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const star = {
  id: '4295806720',
  ra: 45,
  dec: 0,
  g: 17.6,
  bpRp: null,
  plx: null,
  plxErr: null,
  pmRa: null,
  pmDec: null,
  rv: null,
  teff: null,
};
const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { ...init, headers: { 'Content-Type': 'application/json' } });

describe('API client', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_API_BASE', 'https://api.example.org/');
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('posts the cone anonymously, with no referrer, cookies or caching', async () => {
    fetchMock.mockResolvedValue(json({ stars: [star] }));
    const { apiCone } = await import('./client');
    expect(await apiCone(45, 0, 'all')).toEqual([star]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example.org/v1/cone');
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'error',
      cache: 'no-store',
    });
    expect(JSON.parse(init.body)).toEqual({ ra: 45, dec: 0, depth: 'all' });
  });

  it('never builds a path from an id that is not a Gaia id', async () => {
    const { apiLiterature, apiStarById } = await import('./client');
    expect(await apiStarById('../admin')).toBeNull();
    expect(await apiLiterature('1 OR 1=1')).toEqual({ known: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('turns malformed or non-JSON answers into ApiUnavailable', async () => {
    const { apiCone, ApiUnavailable } = await import('./client');
    fetchMock.mockResolvedValueOnce(json({ stars: [{ ...star, id: 1 }] }));
    await expect(apiCone(45, 0, 'all')).rejects.toBeInstanceOf(ApiUnavailable);
    fetchMock.mockResolvedValueOnce(new Response('<html>', { headers: { 'Content-Type': 'text/html' } }));
    await expect(apiCone(45, 0, 'all')).rejects.toBeInstanceOf(ApiUnavailable);
  });

  it('is what the Gaia search uses when configured, as CatalogueUnavailable on failure', async () => {
    const { starsAround, starById, CatalogueUnavailable } = await import('../sky/gaia');
    fetchMock.mockResolvedValueOnce(json({ stars: [star] }));
    expect(await starsAround(45, 0, 'faint')).toEqual([star]);
    fetchMock.mockResolvedValueOnce(json({}, { status: 503 }));
    await expect(starById(star.id)).rejects.toBeInstanceOf(CatalogueUnavailable);
    expect(fetchMock.mock.calls.every(([url]) => String(url).startsWith('https://api.example.org/v1/'))).toBe(true);
  });
});

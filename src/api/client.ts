/**
 * Calls to our own catalogue server (src/api/contract.ts, docs/BACKEND.md).
 * Used only when the build sets VITE_API_BASE; otherwise the site talks to the
 * public services exactly as before.
 *
 * Every request is anonymous: no cookies or HTTP auth (credentials: 'omit'),
 * the page's address never sent as Referer (it holds the visitor's place and
 * time), no redirects followed, a timeout, and a size cap on the answer.
 */
import { API_BASE } from '../config';
import type { Depth, Star } from '../sky/gaia';
import type { Literature } from '../sky/simbad';
import {
  BadResponse,
  coneRequest,
  MAX_RESPONSE_BYTES,
  parseCone,
  parseLiteratureResponse,
  parseStarById,
  paths,
  SOURCE_ID,
} from './contract';

export const apiEnabled = () => Boolean(API_BASE);

/** The server could not answer (down, slow, refused or malformed). */
export class ApiUnavailable extends Error {}

const TIMEOUT_MS = 20_000;

async function request(path: string, init: RequestInit & { accept: string }, signal?: AbortSignal): Promise<Response> {
  if (!API_BASE) throw new ApiUnavailable('no API configured');
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const { accept, headers, ...rest } = init;
  const res = await fetch(`${API_BASE.replace(/\/$/, '')}${path}`, {
    ...rest,
    headers: { Accept: accept, ...headers },
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    redirect: 'error',
    cache: init.method === 'POST' ? 'no-store' : 'default',
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  }).catch(e => {
    if (signal?.aborted) throw e;
    throw new ApiUnavailable(String(e));
  });
  const size = Number(res.headers.get('Content-Length'));
  if (size > MAX_RESPONSE_BYTES) throw new ApiUnavailable('answer too large');
  return res;
}

async function readJson(res: Response): Promise<unknown> {
  if (!res.ok) throw new ApiUnavailable(`HTTP ${res.status}`);
  if (!/^application\/json\b/.test(res.headers.get('Content-Type') ?? '')) throw new ApiUnavailable('answer is not JSON');
  const body = await res.text();
  if (body.length > MAX_RESPONSE_BYTES) throw new ApiUnavailable('answer too large');
  try {
    return JSON.parse(body);
  } catch {
    throw new ApiUnavailable('answer is not JSON');
  }
}

/** Wraps contract failures so callers see one "unavailable" error. */
async function checked<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (e) {
    if (e instanceof BadResponse) throw new ApiUnavailable(`malformed answer: ${e.message}`);
    throw e;
  }
}

export function apiCone(ra: number, dec: number, depth: Depth, signal?: AbortSignal): Promise<Star[]> {
  return checked(async () => {
    const body = JSON.stringify(coneRequest(ra, dec, depth));
    const res = await request(
      paths.cone(),
      { method: 'POST', body, accept: 'application/json', headers: { 'Content-Type': 'application/json' } },
      signal,
    );
    return parseCone(await readJson(res));
  });
}

export function apiStarById(id: string, signal?: AbortSignal): Promise<Star | null> {
  if (!SOURCE_ID.test(id)) return Promise.resolve(null);
  return checked(async () => {
    const res = await request(paths.star(id), { method: 'GET', accept: 'application/json' }, signal);
    if (res.status === 404) return null;
    return parseStarById(await readJson(res), id);
  });
}

export function apiLiterature(id: string, signal?: AbortSignal): Promise<Literature> {
  if (!SOURCE_ID.test(id)) return Promise.resolve({ known: false });
  return checked(async () => {
    const res = await request(paths.literature(id), { method: 'GET', accept: 'application/json' }, signal);
    return parseLiteratureResponse(await readJson(res));
  });
}

/** The raw VOTable, or null when DR4 has no epoch data for the star. */
export async function apiEpochAstrometry(id: string, signal?: AbortSignal): Promise<string | null> {
  if (!SOURCE_ID.test(id)) return null;
  const res = await request(paths.epochAstrometry(id), { method: 'GET', accept: 'application/x-votable+xml' }, signal);
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiUnavailable(`HTTP ${res.status}`);
  const body = await res.text();
  if (body.length > MAX_RESPONSE_BYTES * 5) throw new ApiUnavailable('answer too large');
  return body;
}

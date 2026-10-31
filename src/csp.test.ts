import { describe, expect, it } from 'vitest';
import { checkPublicEnv, contentSecurityPolicy, origins } from './csp';

describe('Content-Security-Policy', () => {
  it('reduces service URLs to origins, tile templates included', () => {
    expect(origins(['https://tile.openstreetmap.org/{z}/{x}/{y}.png', 'https://a.org/x?y', undefined, 'nope'])).toEqual([
      'https://a.org',
      'https://tile.openstreetmap.org',
    ]);
  });

  it('allows no inline or third-party scripts', () => {
    const csp = contentSecurityPolicy({ connect: ['https://api.example.org'], img: [] });
    expect(csp).toContain("script-src 'self';");
    expect(csp).toContain("connect-src 'self' https://api.example.org");
    expect(csp).toContain("object-src 'none'");
  });
});

describe('build settings', () => {
  it('accepts the normal settings', () => {
    expect(checkPublicEnv({ VITE_API_BASE: 'https://api.example.org', VITE_DR4_PROXY: 'http://localhost:8787' })).toEqual([]);
  });

  it('refuses secrets, plain http and credentials in URLs', () => {
    expect(checkPublicEnv({ VITE_API_KEY: 'abc' })).toHaveLength(1);
    expect(checkPublicEnv({ VITE_API_BASE: 'http://api.example.org' })[0]).toMatch(/https/);
    expect(checkPublicEnv({ VITE_API_BASE: 'https://u:p@api.example.org' })[0]).toMatch(/credentials/);
    expect(checkPublicEnv({ VITE_API_BASE: 'https://api.example.org/?key=1' })[0]).toMatch(/query/);
  });
});

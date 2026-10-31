import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ca } from './ca';
import { en, type Dict, type Key } from './en';
import { es } from './es';

export type { Key };

/** The site's languages; add one here and as a dictionary file. */
export const LANGS = { en: 'English', es: 'Español', ca: 'Català' } as const;
export type Lang = keyof typeof LANGS;
const DICTS: Record<Lang, Dict> = { en, es, ca };

export type T = (key: Key, vars?: Record<string, string | number>) => string;

function detect(): Lang {
  try {
    const saved = localStorage.getItem('lang');
    if (saved && saved in LANGS) return saved as Lang;
  } catch {
    /* storage blocked */
  }
  const nav = (navigator.language || 'en').slice(0, 2);
  return nav in LANGS ? (nav as Lang) : 'en';
}

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: T }>(null!);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(detect);
  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem('lang', lang);
    } catch {
      /* storage blocked */
    }
  }, [lang]);
  const value = useMemo(() => {
    const dict = DICTS[lang];
    const t: T = (key, vars) => {
      let s = dict[key] ?? en[key];
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
      return s;
    };
    return { lang, setLang, t };
  }, [lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);

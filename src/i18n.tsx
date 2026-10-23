import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const en = {
  'brand': 'Gaia Maps',
  'tagline': 'Find the star right above you',
  'intro':
    'Gaia has charted almost two billion stars. One of them is right above you — and you are probably the first person ever to look for it.',
  'mode.now': 'Right now',
  'mode.moment': 'A moment',
  'place': 'Place',
  'place.search': 'Search a place…',
  'place.locate': 'Use my location',
  'place.locating': 'Locating…',
  'place.hint': 'Search, use your location, or tap the map.',
  'place.denied': 'Location is blocked. Search a place or tap the map instead.',
  'place.notFound': 'No place found with that name.',
  'place.unnamed': 'Selected point',
  'when': 'When',
  'when.date': 'Date',
  'when.time': 'Local time',
  'when.zone': 'Local time at that place · {zone}',
  'depth': 'How deep',
  'depth.naked-eye': 'Eye',
  'depth.bright': 'Bright',
  'depth.faint': 'Faint',
  'depth.all': 'Deepest',
  'depth.naked-eye.hint': 'Stars you can see without a telescope, within 20° of the zenith.',
  'depth.bright.hint': 'The 400 nearest-to-zenith stars brighter than magnitude 13 — binocular stars.',
  'depth.faint.hint': 'The 400 closest stars down to magnitude 19, deep in the telescope range.',
  'depth.all.hint': 'Everything Gaia saw within 400″ of the zenith — the exact star above you.',
  'go': 'Find my star',
  'go.again': 'Search again',
  'loading': 'Asking Gaia…',
  'error.catalogue': 'The Gaia catalogue (CDS VizieR) did not answer. Try again in a minute.',
  'error.none': 'No stars found here at this depth. Try a deeper search.',
  'result.zenith': 'Your star',
  'result.selected': 'Selected star',
  'result.count': '{n} stars above {place}',
  'result.tapHint': 'Tap any star on the map to learn about it.',
  'result.backToZenith': 'Back to my star',
  'fact.distance': 'Distance',
  'fact.distance.value': '{ly} light-years',
  'fact.distance.unknown': 'Too far for a precise Gaia distance',
  'fact.light': 'Its light left in',
  'fact.light.value': 'the year {year}',
  'fact.light.valueBce': '{year} BCE',
  'fact.colour': 'Colour',
  'fact.colour.value': '{temp} K · type {cls}',
  'fact.brightness': 'Brightness',
  'fact.brightness.visible': 'G {g} · visible to the eye',
  'fact.brightness.faint': 'G {g} · {x}× too faint for the eye',
  'fact.luminosity': 'Luminosity',
  'fact.luminosity.value': '{x}× the Sun',
  'fact.motion': 'Moves across the sky',
  'fact.motion.value': '{pm} mas per year',
  'fact.rv': 'Radial velocity',
  'fact.rv.value': '{v} km/s {dir}',
  'fact.rv.away': 'away from us',
  'fact.rv.towards': 'towards us',
  'fact.position': 'Position',
  'fact.id': 'Gaia DR3',
  'action.certificate': 'Certificate',
  'action.share': 'Share',
  'action.copied': 'Link copied',
  'action.simbad': 'More in SIMBAD',
  'cert.title': 'Make a certificate',
  'cert.field.title': 'Title',
  'cert.field.dedication': 'Dedication (optional)',
  'cert.defaultTitle': 'A star of our own',
  'cert.pdf': 'Download PDF',
  'cert.png': 'Download image',
  'cert.making': 'Drawing…',
  'cert.narrative':
    'At this moment, this star shone straight above this place. Gaia measured it; almost certainly, no one had ever looked for it before.',
  'cert.hr': 'Among its neighbours',
  'cert.hr.caption': 'Colour and true brightness of 1.9 million stars within 650 light-years, measured by Gaia. Yours is marked.',
  'cert.mw': 'In the Milky Way',
  'cert.mw.caption': 'Our Galaxy seen from above. The Sun is the small circle; your star is marked.',
  'cert.mw.unknown': 'Gaia could not measure this star’s distance, so its place in the Galaxy is unknown.',
  'cert.hr.hotter': 'hotter',
  'cert.hr.cooler': 'cooler',
  'cert.hr.brighter': 'brighter',
  'cert.mw.sun': 'Sun',
  'cert.mw.centre': 'centre',
  'cert.chart': 'The sky straight above',
  'cert.footer': 'Data: ESA/Gaia/DPAC, Gaia DR3 · Made with Gaia Maps',
  'about': 'About',
  'about.title': 'About Gaia Maps',
  'about.p1':
    'The European Space Agency’s Gaia mission measured the position, brightness, colour and distance of almost two billion stars. Gaia Maps looks up which of them was directly overhead at a given place and time.',
  'about.p2':
    'Stars are drawn on the map beneath where they shine: one degree of sky away from the zenith becomes one degree on the ground, in the same compass direction.',
  'about.p3':
    'Everything runs in your browser. Star data comes from the Gaia DR3 catalogue served by CDS VizieR (Strasbourg) and GAVO (Heidelberg); place names from OpenStreetMap Nominatim; the map from OpenStreetMap.',
  'close': 'Close',
  'language': 'Language',
} as const;

export type Key = keyof typeof en;
type Dict = Record<Key, string>;

const es: Dict = {
  'brand': 'Gaia Maps',
  'tagline': 'Encuentra la estrella justo encima de ti',
  'intro':
    'Gaia ha cartografiado casi dos mil millones de estrellas. Una de ellas está justo encima de ti, y probablemente seas la primera persona que la busca.',
  'mode.now': 'Ahora mismo',
  'mode.moment': 'Un momento',
  'place': 'Lugar',
  'place.search': 'Busca un lugar…',
  'place.locate': 'Usar mi ubicación',
  'place.locating': 'Localizando…',
  'place.hint': 'Busca, usa tu ubicación o toca el mapa.',
  'place.denied': 'La ubicación está bloqueada. Busca un lugar o toca el mapa.',
  'place.notFound': 'No se ha encontrado ningún lugar con ese nombre.',
  'place.unnamed': 'Punto seleccionado',
  'when': 'Cuándo',
  'when.date': 'Fecha',
  'when.time': 'Hora local',
  'when.zone': 'Hora local de ese lugar · {zone}',
  'depth': 'Profundidad',
  'depth.naked-eye': 'A simple vista',
  'depth.bright': 'Brillantes',
  'depth.faint': 'Débiles',
  'depth.all': 'Todas',
  'depth.naked-eye.hint': 'Estrellas visibles sin telescopio, a menos de 20° del cenit.',
  'depth.bright.hint': 'Las 400 estrellas más cercanas al cenit más brillantes que la magnitud 13: estrellas de prismáticos.',
  'depth.faint.hint': 'Las 400 estrellas más cercanas hasta la magnitud 19, territorio de telescopio.',
  'depth.all.hint': 'Todo lo que Gaia vio a menos de 400″ del cenit: la estrella exacta sobre ti.',
  'go': 'Encontrar mi estrella',
  'go.again': 'Buscar de nuevo',
  'loading': 'Preguntando a Gaia…',
  'error.catalogue': 'El catálogo de Gaia (CDS VizieR) no ha respondido. Inténtalo de nuevo en un minuto.',
  'error.none': 'No hay estrellas aquí a esta profundidad. Prueba una búsqueda más profunda.',
  'result.zenith': 'Tu estrella',
  'result.selected': 'Estrella seleccionada',
  'result.count': '{n} estrellas sobre {place}',
  'result.tapHint': 'Toca cualquier estrella del mapa para saber más.',
  'result.backToZenith': 'Volver a mi estrella',
  'fact.distance': 'Distancia',
  'fact.distance.value': '{ly} años luz',
  'fact.distance.unknown': 'Demasiado lejos para una distancia precisa de Gaia',
  'fact.light': 'Su luz salió en',
  'fact.light.value': 'el año {year}',
  'fact.light.valueBce': 'el {year} a. C.',
  'fact.colour': 'Color',
  'fact.colour.value': '{temp} K · tipo {cls}',
  'fact.brightness': 'Brillo',
  'fact.brightness.visible': 'G {g} · visible a simple vista',
  'fact.brightness.faint': 'G {g} · {x} veces demasiado débil para el ojo',
  'fact.luminosity': 'Luminosidad',
  'fact.luminosity.value': '{x} veces el Sol',
  'fact.motion': 'Se mueve en el cielo',
  'fact.motion.value': '{pm} mas al año',
  'fact.rv': 'Velocidad radial',
  'fact.rv.value': '{v} km/s {dir}',
  'fact.rv.away': 'alejándose',
  'fact.rv.towards': 'acercándose',
  'fact.position': 'Posición',
  'fact.id': 'Gaia DR3',
  'action.certificate': 'Certificado',
  'action.share': 'Compartir',
  'action.copied': 'Enlace copiado',
  'action.simbad': 'Más en SIMBAD',
  'cert.title': 'Crear un certificado',
  'cert.field.title': 'Título',
  'cert.field.dedication': 'Dedicatoria (opcional)',
  'cert.defaultTitle': 'Una estrella nuestra',
  'cert.pdf': 'Descargar PDF',
  'cert.png': 'Descargar imagen',
  'cert.making': 'Dibujando…',
  'cert.narrative':
    'En este momento, esta estrella brillaba justo encima de este lugar. Gaia la midió; casi seguro que nadie la había buscado antes.',
  'cert.hr': 'Entre sus vecinas',
  'cert.hr.caption': 'Color y brillo real de 1,9 millones de estrellas a menos de 650 años luz, medidos por Gaia. La tuya está marcada.',
  'cert.mw': 'En la Vía Láctea',
  'cert.mw.caption': 'Nuestra galaxia vista desde arriba. El Sol es el círculo pequeño; tu estrella está marcada.',
  'cert.mw.unknown': 'Gaia no pudo medir la distancia de esta estrella, así que su lugar en la galaxia es desconocido.',
  'cert.hr.hotter': 'más caliente',
  'cert.hr.cooler': 'más fría',
  'cert.hr.brighter': 'más brillante',
  'cert.mw.sun': 'Sol',
  'cert.mw.centre': 'centro',
  'cert.chart': 'El cielo justo encima',
  'cert.footer': 'Datos: ESA/Gaia/DPAC, Gaia DR3 · Hecho con Gaia Maps',
  'about': 'Acerca de',
  'about.title': 'Acerca de Gaia Maps',
  'about.p1':
    'La misión Gaia de la Agencia Espacial Europea midió la posición, el brillo, el color y la distancia de casi dos mil millones de estrellas. Gaia Maps busca cuál de ellas estaba justo encima de un lugar en un momento dado.',
  'about.p2':
    'Las estrellas se dibujan en el mapa debajo de donde brillan: un grado de cielo desde el cenit se convierte en un grado sobre el terreno, en la misma dirección.',
  'about.p3':
    'Todo funciona en tu navegador. Los datos estelares vienen del catálogo Gaia DR3 servido por CDS VizieR (Estrasburgo) y GAVO (Heidelberg); los nombres de lugares, de OpenStreetMap Nominatim; el mapa, de OpenStreetMap.',
  'close': 'Cerrar',
  'language': 'Idioma',
};

const ca: Dict = {
  'brand': 'Gaia Maps',
  'tagline': 'Troba l’estel just damunt teu',
  'intro':
    'Gaia ha cartografiat gairebé dos mil milions d’estels. Un d’ells és just damunt teu, i probablement ets la primera persona que el busca.',
  'mode.now': 'Ara mateix',
  'mode.moment': 'Un moment',
  'place': 'Lloc',
  'place.search': 'Cerca un lloc…',
  'place.locate': 'Fes servir la meva ubicació',
  'place.locating': 'Localitzant…',
  'place.hint': 'Cerca, fes servir la teva ubicació o toca el mapa.',
  'place.denied': 'La ubicació està bloquejada. Cerca un lloc o toca el mapa.',
  'place.notFound': 'No s’ha trobat cap lloc amb aquest nom.',
  'place.unnamed': 'Punt seleccionat',
  'when': 'Quan',
  'when.date': 'Data',
  'when.time': 'Hora local',
  'when.zone': 'Hora local d’aquell lloc · {zone}',
  'depth': 'Profunditat',
  'depth.naked-eye': 'A ull nu',
  'depth.bright': 'Brillants',
  'depth.faint': 'Febles',
  'depth.all': 'Tots',
  'depth.naked-eye.hint': 'Estels visibles sense telescopi, a menys de 20° del zenit.',
  'depth.bright.hint': 'Els 400 estels més propers al zenit més brillants que la magnitud 13: estels de prismàtics.',
  'depth.faint.hint': 'Els 400 estels més propers fins a la magnitud 19, territori de telescopi.',
  'depth.all.hint': 'Tot el que Gaia va veure a menys de 400″ del zenit: l’estel exacte damunt teu.',
  'go': 'Troba el meu estel',
  'go.again': 'Torna a cercar',
  'loading': 'Preguntant a Gaia…',
  'error.catalogue': 'El catàleg de Gaia (CDS VizieR) no ha respost. Torna-ho a provar d’aquí a un minut.',
  'error.none': 'No hi ha estels aquí a aquesta profunditat. Prova una cerca més profunda.',
  'result.zenith': 'El teu estel',
  'result.selected': 'Estel seleccionat',
  'result.count': '{n} estels sobre {place}',
  'result.tapHint': 'Toca qualsevol estel del mapa per saber-ne més.',
  'result.backToZenith': 'Torna al meu estel',
  'fact.distance': 'Distància',
  'fact.distance.value': '{ly} anys llum',
  'fact.distance.unknown': 'Massa lluny per a una distància precisa de Gaia',
  'fact.light': 'La seva llum va sortir',
  'fact.light.value': 'l’any {year}',
  'fact.light.valueBce': 'el {year} aC',
  'fact.colour': 'Color',
  'fact.colour.value': '{temp} K · tipus {cls}',
  'fact.brightness': 'Brillantor',
  'fact.brightness.visible': 'G {g} · visible a ull nu',
  'fact.brightness.faint': 'G {g} · {x} vegades massa feble per a l’ull',
  'fact.luminosity': 'Lluminositat',
  'fact.luminosity.value': '{x} vegades el Sol',
  'fact.motion': 'Es mou pel cel',
  'fact.motion.value': '{pm} mas per any',
  'fact.rv': 'Velocitat radial',
  'fact.rv.value': '{v} km/s {dir}',
  'fact.rv.away': 'allunyant-se',
  'fact.rv.towards': 'apropant-se',
  'fact.position': 'Posició',
  'fact.id': 'Gaia DR3',
  'action.certificate': 'Certificat',
  'action.share': 'Comparteix',
  'action.copied': 'Enllaç copiat',
  'action.simbad': 'Més a SIMBAD',
  'cert.title': 'Crea un certificat',
  'cert.field.title': 'Títol',
  'cert.field.dedication': 'Dedicatòria (opcional)',
  'cert.defaultTitle': 'Un estel nostre',
  'cert.pdf': 'Descarrega el PDF',
  'cert.png': 'Descarrega la imatge',
  'cert.making': 'Dibuixant…',
  'cert.narrative':
    'En aquest moment, aquest estel brillava just damunt d’aquest lloc. Gaia el va mesurar; gairebé segur que ningú no l’havia buscat mai abans.',
  'cert.hr': 'Entre els seus veïns',
  'cert.hr.caption': 'Color i brillantor real d’1,9 milions d’estels a menys de 650 anys llum, mesurats per Gaia. El teu està marcat.',
  'cert.mw': 'A la Via Làctia',
  'cert.mw.caption': 'La nostra galàxia vista des de dalt. El Sol és el cercle petit; el teu estel està marcat.',
  'cert.mw.unknown': 'Gaia no va poder mesurar la distància d’aquest estel, així que el seu lloc a la galàxia és desconegut.',
  'cert.hr.hotter': 'més calent',
  'cert.hr.cooler': 'més fred',
  'cert.hr.brighter': 'més brillant',
  'cert.mw.sun': 'Sol',
  'cert.mw.centre': 'centre',
  'cert.chart': 'El cel just damunt',
  'cert.footer': 'Dades: ESA/Gaia/DPAC, Gaia DR3 · Fet amb Gaia Maps',
  'about': 'Quant a',
  'about.title': 'Quant a Gaia Maps',
  'about.p1':
    'La missió Gaia de l’Agència Espacial Europea va mesurar la posició, la brillantor, el color i la distància de gairebé dos mil milions d’estels. Gaia Maps cerca quin d’ells era just damunt d’un lloc en un moment donat.',
  'about.p2':
    'Els estels es dibuixen al mapa a sota d’on brillen: un grau de cel des del zenit esdevé un grau sobre el terreny, en la mateixa direcció.',
  'about.p3':
    'Tot funciona al teu navegador. Les dades estel·lars vénen del catàleg Gaia DR3 servit per CDS VizieR (Estrasburg) i GAVO (Heidelberg); els noms de llocs, d’OpenStreetMap Nominatim; el mapa, d’OpenStreetMap.',
  'close': 'Tanca',
  'language': 'Idioma',
};

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

"""
Gaia DR4 pre-release (June 2026): epoch astrometry for 12 sources.

Turns ESA's VOTable into two files:
  public/dr4-preview.json            what the site shows until DR4 is public
  src/dr4/fixtures/one-source.vot    one source, untouched, so the browser's
                                     VOTable parser is tested on the real format

Run (no astropy needed):
  curl -O https://anonftp.cosmos.esa.int/pub/GAIA_PUBLIC_DATA/Gaia_DR4/dr4-prerelease/gaia-dr4-prerelease-epoch-astrometry_2026-06-26.zip
  unzip gaia-dr4-prerelease-epoch-astrometry_2026-06-26.zip -d dr4pre
  python3 scripts/dr4_prerelease.py dr4pre/GAIA_DR4_PRERELEASE_EPOCH_ASTROMETRY_RAW.xml

Details: https://www.cosmos.esa.int/web/gaia/dr4-prerelease
"""

import base64
import json
import struct
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NS = {'v': 'http://www.ivoa.net/xml/VOTable/v1.3'}
SIZE = {'long': 8, 'double': 8, 'float': 4, 'short': 2, 'int': 4, 'boolean': 1}
CODE = {'long': 'q', 'double': 'd', 'float': 'f', 'short': 'h', 'int': 'i'}
FIXTURE_SOURCE = 2237987199365376  # a quasar: few transits, small file

# From the pre-release page.
SAMPLE = {
    4181040337841125632: ('HD 183633', 'parallax'),
    3926186255616949504: (None, 'parallax'),
    435469040545191680: (None, 'parallax'),
    1663617687609809280: ('LSPM J1324+6124', 'magnitude'),
    2309425390592896: (None, 'magnitude'),
    20694084440761600: (None, 'magnitude'),
    2237987199365376: (None, 'qso'),
    60730287810150016: (None, 'qso'),
    10973744521070720: (None, 'qso'),
    3937211745905473024: ('HD 114762', 'orbit'),
    1457486023639239296: ('Gaia-4', 'orbit'),
    4318465066420528000: ('Gaia BH3', 'orbit'),
}


def read(path):
    tree = ET.parse(path)
    root = tree.getroot()
    spec = [(f.get('name'), f.get('datatype'), f.get('arraysize')) for f in root.findall('.//v:FIELD', NS)]
    stream = root.find('.//v:STREAM', NS)
    raw = base64.b64decode(''.join(stream.text.split()))
    nmask = (len(spec) + 7) // 8
    rows, p = [], 0
    while p < len(raw):
        start = p
        p += nmask
        row = {}
        for name, dt, arr in spec:
            n = 1
            if arr == '*':
                (n,) = struct.unpack('>i', raw[p:p + 4])
                p += 4
            if dt == 'boolean':
                v = [chr(b) == 'T' for b in raw[p:p + n]]
            else:
                v = list(struct.unpack('>' + CODE[dt] * n, raw[p:p + SIZE[dt] * n]))
            p += SIZE[dt] * n
            row[name] = v if arr == '*' else v[0]
        row['_bytes'] = raw[start:p]
        rows.append(row)
    return tree, stream, rows


def r(x, d):
    return None if x != x else round(x, d)  # NaN -> null


def main(src):
    tree, stream, rows = read(src)
    by = defaultdict(list)
    for row in rows:
        by[row['source_id']].append(row)

    sources = []
    for sid, (name, group) in SAMPLE.items():
        transits = []
        for row in sorted(by[sid], key=lambda x: x['obs_time_tcb'][0]):
            transits.append({
                'id': str(row['transit_id']),
                'g': r(row['g_mag'], 2),
                'gClass': row['g_class'],
                'pf': r(row['parallax_factor_al'], 4),
                # Transit start (ns TCB since J2010.0, as a string: too big for a
                # JSON double), then one entry per CCD: milliseconds since the
                # start, scan angle (deg), along-scan centroid offset and its
                # error (mas), and whether AGIS used it.
                't0': str(row['obs_time_tcb'][0]),
                'dt': [round((x - row['obs_time_tcb'][0]) / 1e6) for x in row['obs_time_tcb']],
                'psi': [r(x, 4) for x in row['scan_pos_angle']],
                'w': [r(x, 3) for x in row['centroid_pos_al']],
                'e': [r(x, 3) for x in row['centroid_pos_error_al']],
                'used': [1 if u else 0 for u in row['used_by_agis_al']],
            })
        first = by[sid][0]
        sources.append({
            'id': str(sid),
            'name': name,
            'group': group,
            'ra0': first['ra0'],
            'dec0': first['dec0'],
            'transits': transits,
        })

    out = ROOT / 'public' / 'dr4-preview.json'
    out.write_text(json.dumps({
        'release': 'Gaia DR4 pre-release (June 2026), epoch astrometry',
        'url': 'https://www.cosmos.esa.int/web/gaia/dr4-prerelease',
        'sources': sources,
    }, separators=(',', ':')))
    print(f'{out}: {out.stat().st_size // 1024} kB, {len(sources)} sources, {len(rows)} transits')

    # Fixture: same header, one source's rows.
    stream.text = base64.b64encode(b''.join(row['_bytes'] for row in by[FIXTURE_SOURCE])).decode()
    fixture = ROOT / 'src' / 'dr4' / 'fixtures' / 'one-source.vot'
    fixture.parent.mkdir(parents=True, exist_ok=True)
    ET.register_namespace('', NS['v'])
    tree.write(fixture, encoding='UTF-8', xml_declaration=True)
    print(f'{fixture}: {fixture.stat().st_size // 1024} kB')


if __name__ == '__main__':
    main(sys.argv[1])

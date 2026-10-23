"""Build src/sky/calibration.fixtures.json: Gaia DR3 data for stars of known
spectral type (from SIMBAD), used to test the star classifier.

    python3 scripts/calibration_stars.py
"""
import csv, io, json, urllib.parse, urllib.request
NAMES = ["Barnard's star", 'Proxima Cen', 'Wolf 359', 'Lalande 21185', '61 Cyg A', 'eps Eri', 'tau Cet', '18 Sco', "Kapteyn's star", 'sig Dra', '70 Oph', 'bet CVn', '51 Peg', 'iot Psc', 'tet Per', 'bet Vir', 'alf Crv', 'zet Vir', 'del Leo', 'HD 82741', 'del Tau', 'gam Tau', 'eps Tau', 'bet Cnc', 'omi UMa', 'del Pav', 'mu Her', 'eta Boo', 'zet Cep', 'del Cep', 'eta Aql', 'mu Cep', 'rho Cas', 'VY CMa', 'Sirius B', '40 Eri B', 'Stein 2051 B', 'LP 145-141', 'tau Sco', 'HD 36512', 'lam Ori', 'alf Tri', 'del Cap', 'gam Cyg']
def tap(url, q):
    d = urllib.parse.urlencode({"REQUEST": "doQuery", "LANG": "ADQL", "FORMAT": "csv", "QUERY": q}).encode()
    with urllib.request.urlopen(url, d, timeout=300) as r:
        return list(csv.DictReader(io.TextIOWrapper(r, "utf-8")))
rows = []
for n in NAMES:
    r = tap("https://simbad.cds.unistra.fr/simbad/sim-tap/sync",
            f"SELECT b.main_id, b.sp_type, f.V, i2.id AS gaia FROM ident i JOIN basic b ON b.oid=i.oidref LEFT JOIN allfluxes f ON f.oidref=b.oid JOIN ident i2 ON i2.oidref=b.oid WHERE i.id='{n.replace(chr(39), chr(39)*2)}' AND i2.id LIKE 'Gaia DR3 %'")
    if not r: print("no gaia id:", n); continue
    rows.append({"name": n, "sp": r[0]["sp_type"], "V": r[0]["V"], "id": r[0]["gaia"].split()[-1]})
ids = ",".join(x["id"] for x in rows)
g = {x["source_id"]: x for x in tap("https://gea.esac.esa.int/tap-server/tap/sync",
    f"SELECT source_id, phot_g_mean_mag, bp_rp, parallax, parallax_error, teff_gspphot FROM gaiadr3.gaia_source WHERE source_id IN ({ids})")}
out = []
for x in rows:
    s = g.get(x["id"])
    if not s: print("not in gaia_source:", x["name"]); continue
    f = lambda k: float(s[k]) if s[k] != "" else None
    out.append({**x, "V": float(x["V"]) if x["V"] else None, "g": f("phot_g_mean_mag"), "bpRp": f("bp_rp"), "plx": f("parallax"), "plxErr": f("parallax_error"), "teff": f("teff_gspphot")})
from pathlib import Path
dest = Path(__file__).resolve().parent.parent / "src" / "sky" / "calibration.fixtures.json"
json.dump(out, open(dest, "w"), indent=1)
print(len(out), "stars")

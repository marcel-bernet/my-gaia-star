"""Build public/naked-eye.json: every Gaia DR3 star brighter than G = 6.

One-off build step (the output is committed). The naked-eye depth reads this
file instead of querying a service: a 20° cone with a magnitude cut is slow
on every public Gaia mirror, and ~5 000 stars is small enough to ship.

    python3 scripts/naked_eye_stars.py
"""
import csv, io, json, sys, urllib.parse, urllib.request
from pathlib import Path

G_LIMIT = 6.0
ADQL = f"""
SELECT source_id, ra, dec, phot_g_mean_mag, bp_rp, parallax, parallax_error,
       pmra, pmdec, radial_velocity, teff_gspphot
FROM gaiadr3.gaia_source
WHERE phot_g_mean_mag < {G_LIMIT}
"""
# Column order in the output; keep in sync with src/sky/nakedEye.ts.
COLUMNS = ["id", "ra", "dec", "g", "bpRp", "plx", "plxErr", "pmRa", "pmDec", "rv", "teff"]
DIGITS = [None, 5, 5, 2, 2, 2, 2, 1, 1, 1, 0]

def cell(v: str, digits):
    if v == "":
        return None
    if digits is None:
        return v
    x = round(float(v), digits)
    return int(x) if digits == 0 else x

def main(out: Path) -> None:
    data = urllib.parse.urlencode({"REQUEST": "doQuery", "LANG": "ADQL", "FORMAT": "csv", "QUERY": ADQL}).encode()
    with urllib.request.urlopen("https://gea.esac.esa.int/tap-server/tap/sync", data, timeout=600) as r:
        rows = list(csv.reader(io.TextIOWrapper(r, "utf-8")))[1:]
    stars = [[cell(v, d) for v, d in zip(row, DIGITS)] for row in rows]
    out.write_text(json.dumps({"source": "Gaia DR3 (ESA/Gaia/DPAC)", "gLimit": G_LIMIT, "columns": COLUMNS, "rows": stars}, separators=(",", ":")))
    print(f"{len(stars)} stars -> {out} ({out.stat().st_size // 1024} KiB)", file=sys.stderr)

if __name__ == "__main__":
    main(Path(__file__).resolve().parent.parent / "public" / "naked-eye.json")

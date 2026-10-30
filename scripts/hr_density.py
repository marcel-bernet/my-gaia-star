"""Build public/hr-density.png: a Gaia DR3 colour–magnitude density map.

One-off build step (the output is committed). The Gaia archive bins every
well-measured star within 200 pc server-side, so only the histogram comes
back. The PNG is greyscale log-density; the app colours it.

    python3 -m venv .venv && .venv/bin/pip install pillow numpy
    .venv/bin/python scripts/hr_density.py
"""
import csv, io, json, sys, urllib.parse, urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

# Axis ranges; keep in sync with HR_AXES in src/certificate/panels.ts.
X_MIN, X_MAX, X_BINS = -0.6, 4.6, 520   # BP-RP colour
Y_MIN, Y_MAX, Y_BINS = -4.0, 17.0, 700  # absolute G magnitude (bright at top)

ADQL = """
SELECT FLOOR((bp_rp - ({x_min})) * {sx}) AS x,
       FLOOR((phot_g_mean_mag + 5 * LOG10(parallax) - 10 - ({y_min})) * {sy}) AS y,
       COUNT(*) AS n
FROM gaiadr3.gaia_source
WHERE parallax > 5 AND parallax_over_error > 10
  AND bp_rp >= {lo} AND bp_rp < {hi} AND phot_bp_rp_excess_factor < 1.3 + 0.06 * bp_rp * bp_rp
GROUP BY x, y
"""

def main(out: Path) -> None:
    # The archive caps synchronous results at 50 000 rows, so query in colour slices.
    rows = []
    edges = np.linspace(X_MIN, X_MAX, 9)
    for lo, hi in zip(edges[:-1], edges[1:]):
        q = ADQL.format(x_min=X_MIN, y_min=Y_MIN, sx=X_BINS / (X_MAX - X_MIN), sy=Y_BINS / (Y_MAX - Y_MIN), lo=lo, hi=hi)
        data = urllib.parse.urlencode({"REQUEST": "doQuery", "LANG": "ADQL", "FORMAT": "csv", "QUERY": q}).encode()
        with urllib.request.urlopen("https://gea.esac.esa.int/tap-server/tap/sync", data, timeout=600) as r:
            part = list(csv.DictReader(io.TextIOWrapper(r, "utf-8")))
        assert len(part) < 50000, "slice hit the row cap; use more slices"
        rows += part
    grid = np.zeros((Y_BINS, X_BINS))
    total = 0
    for row in rows:
        x, y, n = int(float(row["x"])), int(float(row["y"])), int(row["n"])
        if 0 <= x < X_BINS and 0 <= y < Y_BINS:
            grid[y, x] += n
            total += n
    img = np.log1p(grid)
    img = (255 * img / img.max()).astype(np.uint8)
    Image.fromarray(img, "L").save(out, optimize=True)
    print(f"{total} stars, {len(rows)} bins -> {out}", file=sys.stderr)

if __name__ == "__main__":
    main(Path(__file__).resolve().parent.parent / "public" / "hr-density.png")

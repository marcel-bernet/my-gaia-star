"""Build public/sky-chart.json: constellation figures, IAU boundaries, names,
and the bright stars to draw them with.

One-off build step (the output is committed). Source: d3-celestial by Olaf
Frohn (BSD 3-clause), https://github.com/ofrohn/d3-celestial — stick figures,
boundaries, Hipparcos stars to magnitude 6 and proper names. Gaia itself
saturates on the brightest stars (the ones that draw the figures), which is
why the charts use Hipparcos.

    python3 scripts/sky_chart.py
"""
import json, sys, urllib.request
from pathlib import Path

BASE = "https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/"
STAR_MAG_LIMIT = 5.8
NAME_MAG_LIMIT = 2.6

# d3-celestial has no Catalan; these follow the usual Catalan forms.
CATALAN = {
    "And": "Andròmeda", "Ant": "Màquina Pneumàtica", "Aps": "Ocell del Paradís", "Aqr": "Aquari",
    "Aql": "Àguila", "Ara": "Altar", "Ari": "Àries", "Aur": "Cotxer", "Boo": "Bover", "Cae": "Cisell",
    "Cam": "Girafa", "Cnc": "Cranc", "CVn": "Llebrers", "CMa": "Ca Major", "CMi": "Ca Menor",
    "Cap": "Capricorn", "Car": "Quilla", "Cas": "Cassiopea", "Cen": "Centaure", "Cep": "Cefeu",
    "Cet": "Balena", "Cha": "Camaleó", "Cir": "Compàs", "Col": "Coloma", "Com": "Cabellera de Berenice",
    "CrA": "Corona Austral", "CrB": "Corona Boreal", "Crv": "Corb", "Crt": "Copa", "Cru": "Creu del Sud",
    "Cyg": "Cigne", "Del": "Dofí", "Dor": "Orada", "Dra": "Drac", "Equ": "Cavallet", "Eri": "Erídan",
    "For": "Forn", "Gem": "Bessons", "Gru": "Grua", "Her": "Hèrcules", "Hor": "Rellotge", "Hya": "Hidra",
    "Hyi": "Hidra Mascle", "Ind": "Indi", "Lac": "Llangardaix", "Leo": "Lleó", "LMi": "Lleó Menor",
    "Lep": "Llebre", "Lib": "Balança", "Lup": "Llop", "Lyn": "Linx", "Lyr": "Lira", "Men": "Taula",
    "Mic": "Microscopi", "Mon": "Unicorn", "Mus": "Mosca", "Nor": "Escaire", "Oct": "Octant",
    "Oph": "Serpentari", "Ori": "Orió", "Pav": "Paó", "Peg": "Pegàs", "Per": "Perseu", "Phe": "Fènix",
    "Pic": "Pintor", "Psc": "Peixos", "PsA": "Peix Austral", "Pup": "Popa", "Pyx": "Brúixola",
    "Ret": "Reticle", "Sge": "Sageta", "Sgr": "Sagitari", "Sco": "Escorpí", "Scl": "Escultor",
    "Sct": "Escut", "Ser": "Serp", "Sex": "Sextant", "Tau": "Taure", "Tel": "Telescopi", "Tri": "Triangle",
    "TrA": "Triangle Austral", "Tuc": "Tucà", "UMa": "Óssa Major", "UMi": "Óssa Menor", "Vel": "Veles",
    "Vir": "Verge", "Vol": "Peix Volador", "Vul": "Guineu",
}

# Spanish overrides where d3-celestial departs from the usual names.
SPANISH = {"CMa": "Can Mayor", "CMi": "Can Menor"}

def fetch(name):
    with urllib.request.urlopen(BASE + name, timeout=120) as r:
        return json.load(r)

def ra360(ra):
    return round(ra % 360, 3)

def pts(line):
    return [[ra360(ra), round(dec, 3)] for ra, dec in line]

def main(out: Path) -> None:
    names = {f["id"]: f["properties"] for f in fetch("constellations.json")["features"]}
    cons = {}
    for cid, p in names.items():
        # English uses the Latin names (d3-celestial's "en" has asterisms like "Big Dipper").
        clean = lambda s: " ".join(s.split())
        cons[cid] = {"names": {"en": clean(p["name"]), "es": SPANISH.get(cid) or clean(p["es"]), "ca": CATALAN[cid]}, "lines": [], "bounds": []}
    # Serpens comes in two pieces (head and tail); both append to "Ser".
    for f in fetch("constellations.lines.json")["features"]:
        cons[f["id"]]["lines"] += [pts(l) for l in f["geometry"]["coordinates"]]
    for f in fetch("constellations.bounds.json")["features"]:
        g = f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        cons[f["id"]]["bounds"] += [pts(poly[0]) for poly in polys]

    starnames = fetch("starnames.json")
    stars = []
    for f in fetch("stars.6.json")["features"]:
        mag = f["properties"]["mag"]
        if mag > STAR_MAG_LIMIT:
            continue
        ra, dec = f["geometry"]["coordinates"]
        bv = f["properties"].get("bv")
        n = starnames.get(str(f["id"]), {}).get("name") or None
        stars.append([ra360(ra), round(dec, 3), mag, round(float(bv), 2) if bv not in (None, "") else None, n if n and mag <= NAME_MAG_LIMIT else None])

    data = {"source": "d3-celestial (c) Olaf Frohn, BSD 3-clause", "constellations": cons, "stars": stars}
    out.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    print(f"{len(cons)} constellations, {len(stars)} stars -> {out} ({out.stat().st_size // 1024} KiB)", file=sys.stderr)

if __name__ == "__main__":
    main(Path(__file__).resolve().parent.parent / "public" / "sky-chart.json")

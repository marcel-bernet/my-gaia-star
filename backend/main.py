"""FastAPI backend for GaiaMaps.

Exposes two endpoints:
- POST /get-stars: Query Gaia DR3 for stars above a given location/time.
- POST /star-pdf: Generate a single-page PDF for a selected star.

This module also contains small helpers for coordinate rotation to place
stars relative to the local zenith in a simple ENU frame for the overlay.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from astropy.time import Time
from astropy.coordinates import AltAz, EarthLocation, ICRS, SkyCoord
import astropy.units as u
import numpy as np
from astroquery.gaia import Gaia
from astropy import coordinates as coords
from datetime import datetime, timezone
import sys
# No need to modify sys.path for backend-local import
from generate_pdf import generate_pdf
from fastapi.responses import StreamingResponse
import io
from fastapi.responses import JSONResponse

# Helper functions for coordinate rotation

def rodrigues(axis: np.ndarray, angle: float) -> np.ndarray:
    """Rodrigues' rotation formula for rotating around *axis* by *angle* (radians)."""
    axis = axis / np.linalg.norm(axis)
    K = np.array([[0.0, -axis[2], axis[1]],
                  [axis[2], 0.0, -axis[0]],
                  [-axis[1], axis[0], 0.0]])
    I = np.eye(3)
    return I * np.cos(angle) + K * np.sin(angle) + np.outer(axis, axis) * (1 - np.cos(angle))

def rotation_from_two_vectors(A: np.ndarray, B: np.ndarray,
                              A_prime: np.ndarray, B_prime: np.ndarray) -> np.ndarray:
    """Return rotation matrix sending A→A' and B→B' (all unit vectors)."""
    A, B, A_prime, B_prime = [v / np.linalg.norm(v) for v in (A, B, A_prime, B_prime)]

    # Step 1: rotate A to A'
    cos_w = np.clip(np.dot(A, A_prime), -1.0, 1.0)
    omega = np.arccos(cos_w)
    if np.isclose(omega, 0):
        R1 = np.eye(3)
    elif np.isclose(omega, np.pi):
        # 180° rotation – choose any perpendicular axis
        perp = np.array([1.0, 0.0, 0.0])
        if abs(np.dot(perp, A)) > 0.9:
            perp = np.array([0.0, 1.0, 0.0])
        axis = np.cross(A, perp); axis /= np.linalg.norm(axis)
        R1 = rodrigues(axis, omega)
    else:
        axis = np.cross(A, A_prime); axis /= np.linalg.norm(axis)
        R1 = rodrigues(axis, omega)

    # Step 2: twist around A' to align B with B'
    B1 = R1 @ B
    p1 = B1 - np.dot(A_prime, B1) * A_prime
    p2 = B_prime - np.dot(A_prime, B_prime) * A_prime
    p1 /= np.linalg.norm(p1); p2 /= np.linalg.norm(p2)
    sin_phi = np.dot(A_prime, np.cross(p1, p2))
    cos_phi = np.dot(p1, p2)
    phi = np.arctan2(sin_phi, cos_phi)
    R2 = rodrigues(A_prime, phi)
    return R2 @ R1

def radec_to_vector(ra_deg: float, dec_deg: float) -> np.ndarray:
    """Convert RA/Dec (degrees) to unit vector in ICRS."""
    ra_rad = np.deg2rad(ra_deg)
    dec_rad = np.deg2rad(dec_deg)
    x = np.cos(dec_rad) * np.cos(ra_rad)
    y = np.cos(dec_rad) * np.sin(ra_rad)
    z = np.sin(dec_rad)
    return np.array([x, y, z])

app = FastAPI(title="GaiaMaps API", description="API for querying Gaia stars above a location at a given time.")

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from enum import Enum

class BrightnessMode(str, Enum):
    naked_eye = "naked-eye"  # G < 6
    bright = "bright"        # G < 13
    faint = "faint"          # G < 19
    all = "all"              # no magnitude limit

class StarRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90, description="Latitude in degrees")
    lon: float = Field(..., ge=-180, le=180, description="Longitude in degrees")
    datetime_iso: str = Field(..., description="Datetime in ISO format (UTC)")
    brightness_mode: BrightnessMode = BrightnessMode.all
    include_velocity: bool = False
    include_distance: bool = True
    # Optional cap to bound results for custom clients
    limit: Optional[int] = Field(None, ge=1, le=10000, description="Override maximum number of stars to return")

class PDFRequest(BaseModel):
    star_info: Dict[str, Any]

class StarOut(BaseModel):
    ra: Optional[float]
    dec: Optional[float]
    phot_g_mean_mag: Optional[float]
    bp_rp: Optional[float]
    alt_diff: Optional[float]
    az_diff: Optional[float]
    SOURCE_ID: Optional[Any]
    source_id: Optional[Any]
    # Additional fields allowed
    class Config:
        extra = "allow"

class GetStarsResponse(BaseModel):
    center: Dict[str, float]
    stars: List[StarOut]

@app.post("/get-stars", response_model=GetStarsResponse, summary="Get Gaia stars above a location at a given time")
def get_stars(req: StarRequest):
    """Return Gaia stars above the given lat/lon at the specified UTC datetime.

    Stars are ordered by angular distance from the zenith. The query radius and
    magnitude cuts are controlled by ``brightness_mode``. The response also
    includes small offsets (``alt_diff``, ``az_diff``) used by the frontend to
    place markers relative to the selected location.
    """
    print(f"[LOG] /get-stars called with lat={req.lat}, lon={req.lon}, datetime_iso={req.datetime_iso}", file=sys.stderr)
    try:
        # Validate datetime
        try:
            selected_datetime = datetime.fromisoformat(req.datetime_iso)
            if selected_datetime.tzinfo is None:
                selected_datetime = selected_datetime.replace(tzinfo=timezone.utc)
        except Exception as e:
            print(f"[ERROR] Invalid datetime format: {req.datetime_iso} ({e})", file=sys.stderr)
            raise HTTPException(status_code=400, detail="Invalid datetime format. Use ISO format (e.g. 2024-06-01T12:00:00Z)")

        # Prepare time and location
        utc_time = Time(selected_datetime)
        observer_location = EarthLocation(lat=req.lat*u.deg, lon=req.lon*u.deg)
        altaz_frame = AltAz(obstime=utc_time, location=observer_location)

        observer_aux_location = EarthLocation(lat=(req.lat+1e-4)*u.deg, lon=req.lon*u.deg)
        altaz_frame_aux = AltAz(obstime=utc_time, location=observer_aux_location)

        # Compute zenith
        zenith_icrs = SkyCoord(alt=90*u.deg, az=0*u.deg, frame=altaz_frame).transform_to(ICRS())
        center = coords.SkyCoord(ra=zenith_icrs.ra, dec=zenith_icrs.dec, frame='icrs')

        zenith_icrs_aux = SkyCoord(alt=90*u.deg, az=0*u.deg, frame=altaz_frame_aux).transform_to(ICRS())
        center_aux = coords.SkyCoord(ra=zenith_icrs_aux.ra, dec=zenith_icrs_aux.dec, frame='icrs')

        # --- Build query based on settings ---
        center_ra = center.ra.deg
        center_dec = center.dec.deg

        # Defaults
        g_cut = None
        radius_deg = None
        limit_clause = ""

        if req.brightness_mode == BrightnessMode.naked_eye:
            g_cut = 6
            radius_deg = 20.0  # no radius cap
            limit_value = req.limit or 10000
        elif req.brightness_mode == BrightnessMode.bright:
            g_cut = 13
            radius_deg = 10.0
            limit_value = 400
        elif req.brightness_mode == BrightnessMode.faint:
            g_cut = 19
            radius_deg = 2.0
            limit_value = 400
        else:  # all
            g_cut = None
            radius_deg = 400/3600.0  # 400 arcsec
            limit_value = 400

        limit_clause = f"TOP {limit_value} " if limit_value else ""

        where_clauses = []
        if radius_deg is not None:
            where_clauses.append(f"1=CONTAINS(POINT('ICRS', ra, dec), CIRCLE('ICRS', {center_ra}, {center_dec}, {radius_deg}))")
        if g_cut is not None:
            where_clauses.append(f"phot_g_mean_mag < {g_cut}")
        # Ensure numeric columns for optional selections are present
        if req.include_distance:
            where_clauses.append("parallax IS NOT NULL")
        if req.include_velocity:
            where_clauses.append("pmra IS NOT NULL AND pmdec IS NOT NULL")

        if not where_clauses:
            where_sql = "1=1"
        else:
            where_sql = " AND ".join(where_clauses)

        query = f"""
        SELECT {limit_clause}*, DISTANCE(POINT('ICRS', ra, dec), POINT('ICRS', {center_ra}, {center_dec})) AS ang_dist
        FROM gaiadr3.gaia_source
        WHERE {where_sql}
        ORDER BY ang_dist ASC
        """
        job = Gaia.launch_job(query)
        results = job.get_results()

        # --- Build rotation matrix from ICRS to local ENU (east-north-up) ---
        A_vec = radec_to_vector(center_ra, center_dec)
        B_vec = radec_to_vector(center_aux.ra.deg, center_aux.dec.deg)

        A_prime = np.array([0.0, 0.0, 1.0])  # local zenith (Up) in ENU
        # North reference vector at same angular separation from zenith
        delta_rad = np.arccos(np.clip(np.dot(A_vec, B_vec), -1.0, 1.0))
        B_prime = np.array([0.0, np.sin(delta_rad), np.cos(delta_rad)])  # aligns with ENU north

        R_icrs_to_enu = rotation_from_two_vectors(A_vec, B_vec, A_prime, B_prime)

        stars = []
        for row in results:
            # --- Transform star to local ENU ---
            v_icrs = radec_to_vector(row['ra'], row['dec'])
            v_enu = R_icrs_to_enu @ v_icrs  # (east, north, up)

            # Angular separation from zenith
            z_comp = np.clip(v_enu[2], -1.0, 1.0)
            theta = np.arccos(z_comp)  # radians, small for near-zenith stars

            if theta < 1e-8:
                d_east_deg = 0.0
                d_north_deg = 0.0
            else:
                horiz_vec = v_enu[:2]  # east, north components
                horiz_norm = np.linalg.norm(horiz_vec)
                if horiz_norm < 1e-12:
                    d_east_deg = 0.0
                    d_north_deg = 0.0
                else:
                    unit_horiz = horiz_vec / horiz_norm
                    # Scale unit horizontal direction by angular distance (deg)
                    d_deg = np.degrees(theta)
                    # Convert east angular offset to degrees of longitude at current latitude
                    cos_lat = np.cos(np.deg2rad(req.lat)) if abs(req.lat) < 89.999 else 1e-6
                    d_east_deg = (d_deg * unit_horiz[0]) / cos_lat
                    d_north_deg = d_deg * unit_horiz[1]

            star = {k: (row[k].item() if hasattr(row[k], 'item') else row[k]) for k in row.keys()}
            star['az_diff'] = d_east_deg   # east (+) / west (-)
            star['alt_diff'] = d_north_deg # north (+) / south (-)

            if 'SOURCE_ID' not in star:
                star['SOURCE_ID'] = None
            if 'source_id' not in star:
                star['source_id'] = None
            stars.append(star)

        print(f"[LOG] Query returned {len(stars)} stars", file=sys.stderr)
        return {"center": {"ra": center_ra, "dec": center_dec}, "stars": stars}

    except HTTPException as he:
        print(f"[ERROR] HTTPException: {he.detail}", file=sys.stderr)
        raise
    except Exception as e:
        # User-friendly error for Gaia archive maintenance or VOTABLE errors
        if "VOTABLE" in str(e) or "maintenance" in str(e).lower():
            print(f"[ERROR] Gaia archive unavailable: {str(e)}", file=sys.stderr)
            return JSONResponse(
                status_code=503,
                content={"detail": "Gaia archive is temporarily unavailable. Please try again later."}
            )
        print(f"[ERROR] Internal error: {str(e)}", file=sys.stderr)
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

@app.post("/star-pdf")
def star_pdf(req: PDFRequest):
    star_info = req.star_info
    # Always set title and narrative
    star_info['title'] = "My special star"
    star_info['subtitle'] = star_info.get('subtitle', 'Your special moment')
    star_info['narrative'] = (
        "This star, likely never noticed by any human before, "
        "shone directly above you on your special day..."
    )
    # --- Robust field mapping ---
    # Distance in light years from parallax (mas)
    parallax = star_info.get('parallax')
    if parallax is None:
        parallax = star_info.get('parallax_mas')
    try:
        parallax_val = float(parallax)
    except (TypeError, ValueError):
        parallax_val = None
    if parallax_val and parallax_val > 0:
        distance_pc = 1000.0 / parallax_val
        distance_ly = distance_pc * 3.26156
        star_info['distance_ly'] = round(distance_ly)
        print(f"[PDF] parallax: {parallax_val} mas, distance: {distance_pc:.2f} pc, {distance_ly:.2f} ly")
    # Color index
    if 'color_index' not in star_info and 'bp_rp' in star_info:
        star_info['color_index'] = star_info['bp_rp']
    # Absolute magnitude from Gmag and parallax
    phot_g = star_info.get('phot_g_mean_mag')
    if phot_g is not None and parallax and isinstance(parallax, (int, float)) and parallax > 0:
        abs_mag = phot_g + 5 * (np.log10(parallax) + 1) - 10
        star_info['abs_mag'] = round(abs_mag, 2)
    # Proper motion
    pmra = star_info.get('pmra')
    pmdec = star_info.get('pmdec')
    if pmra is not None and pmdec is not None:
        pm_total = (pmra**2 + pmdec**2) ** 0.5
        star_info['proper_motion'] = f"{pm_total:.1f} mas/yr"
    output = io.BytesIO()
    generate_pdf(star_info, output_path=output)
    output.seek(0)
    return StreamingResponse(output, media_type="application/pdf", headers={
        "Content-Disposition": "attachment; filename=star_report.pdf"
    })

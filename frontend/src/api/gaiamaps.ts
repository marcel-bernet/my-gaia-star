/// <reference types="vite/client" />
/**
 * Client API for the GaiaMaps backend.
 *
 * - fetchStars: POST /get-stars → list of stars for a location/time
 * - fetchStarPDF: POST /star-pdf → triggers a PDF download for a star
 */
import { StarData } from '../types/star';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

import { StarSettings } from '../components/SettingsModal';

export async function fetchStars(
  location: [number, number],
  date: Date,
  settings: StarSettings
): Promise<{ stars: StarData[] }> {
  const [lat, lon] = location;
  const datetime_iso = date.toISOString();
  const res = await fetch(`${BACKEND_URL}/get-stars`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lat,
      lon,
      datetime_iso,
      brightness_mode: settings.brightnessMode,
      include_velocity: settings.includeVelocity,
      include_distance: settings.includeDistance,
    }),
  });
  if (res.status === 503) {
    throw new Error('Catalogue unavailable.');
  }
  if (!res.ok) throw new Error('Failed to fetch stars');
  const data = await res.json();
  // Attach base_lat/base_lng to each star for overlay logic
  return {
    stars: (data.stars || []).map((star: any) => ({
      ...star,
      base_lat: lat,
      base_lng: lon,
    })),
  };
}

export async function fetchStarPDF(star: StarData) {
  const res = await fetch(`${BACKEND_URL}/star-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ star_info: star }),
  });
  if (!res.ok) throw new Error('Failed to fetch PDF');
  const blob = await res.blob();
  // Trigger download
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'star_report.pdf';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
} 
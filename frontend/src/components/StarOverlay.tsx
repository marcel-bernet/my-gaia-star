// Renders stars as colored circle markers and a popup with details.
// Uses BP-RP to estimate color temperature and sizes markers by G magnitude.
import React from 'react';
import { Marker, Popup, Polyline, CircleMarker } from 'react-leaflet';
import { StarData } from '../types/star';

interface StarOverlayProps {
  stars: StarData[];
  fetchStarPDF: (star: StarData) => void;
  zenithStar?: StarData | null;
  zenithPopupOpen?: boolean;
  setZenithPopupOpen?: (open: boolean) => void;
  selectedDate?: Date | null;
}

// Convert BP-RP to effective temperature (K)
function bpRpToTemperature(bp_rp: number): number {
  return 4600 * (1 / (0.92 * bp_rp + 1.7) + 1 / (0.92 * bp_rp + 0.62));
}

// Convert temperature (K) to RGB color (0-255)
function temperatureToRGB(tempK: number): [number, number, number] {
  let temp = tempK / 100.0;
  let red: number, green: number, blue: number;
  // Red
  if (temp <= 66) {
    red = 255;
  } else {
    red = 329.698727446 * Math.pow(temp - 60, -0.1332047592);
    red = Math.min(Math.max(red, 0), 255);
  }
  // Green
  if (temp <= 66) {
    green = 99.4708025861 * Math.log(temp) - 161.1195681661;
    green = Math.min(Math.max(green, 0), 255);
  } else {
    green = 288.1221695283 * Math.pow(temp - 60, -0.0755148492);
    green = Math.min(Math.max(green, 0), 255);
  }
  // Blue
  if (temp >= 66) {
    blue = 255;
  } else if (temp <= 19) {
    blue = 0;
  } else {
    blue = 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
    blue = Math.min(Math.max(blue, 0), 255);
  }
  return [red, green, blue];
}

// Compute marker size for a star based on Gmag
function computeStarSize(gmag: number, minSize = 4, maxSize = 12): number {
  if (gmag < 12) return maxSize;
  if (gmag > 19.5) return minSize;
  return maxSize - (gmag - 12) * (maxSize - minSize) / (19.5 - 12);
}

const bigDipperNames = [
  'Dubhe', 'Merak', 'Phecda', 'Megrez', 'Alioth', 'Mizar', 'Alkaid'
];
const bigDipperConnections: Record<string, string[]> = {
  "Dubhe": ["Merak", "Megrez"],
  "Merak": ["Dubhe", "Phecda"],
  "Phecda": ["Merak", "Megrez"],
  "Megrez": ["Phecda", "Dubhe", "Alioth"],
  "Alioth": ["Megrez", "Mizar"],
  "Mizar": ["Alioth", "Alkaid"],
  "Alkaid": ["Mizar"]
};

async function fetchLocationName(lat: number, lon: number): Promise<string> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
  );
  if (!res.ok) return '';
  const data = await res.json();
  return (
    data.address?.city ||
    data.address?.town ||
    data.address?.village ||
    data.address?.hamlet ||
    data.address?.county ||
    data.address?.state ||
    data.address?.country ||
    data.display_name ||
    ''
  );
}

const StarOverlay: React.FC<StarOverlayProps> = ({ stars, fetchStarPDF, zenithStar, zenithPopupOpen, setZenithPopupOpen, selectedDate }) => {
  // Find index of zenith star
  const zenithIdx = zenithStar ? stars.findIndex(s => s.source_id === zenithStar.source_id || s.SOURCE_ID === zenithStar.SOURCE_ID) : -1;
  return (
    <>
      {/* Draw Big Dipper lines if all 7 stars are present */}
      {(() => {
        const bigDipperStars = stars.filter(s => bigDipperNames.includes(s.name));
        if (bigDipperStars.length === 7) {
          // Map star names to their lat/lng
          const starMap: Record<string, [number, number]> = {};
          bigDipperStars.forEach(star => {
            starMap[star.name] = [
              (star.base_lat || 0) + (star.alt_diff || 0),
              (star.base_lng || 0) + (star.az_diff || 0),
            ];
          });
          const lines: [ [number, number], [number, number] ][] = [];
          const drawn = new Set<string>();
          bigDipperStars.forEach(starA => {
            (bigDipperConnections[starA.name] || []).forEach(nameB => {
              const key = [starA.name, nameB].sort().join('-');
              if (drawn.has(key) || !starMap[nameB]) return;
              drawn.add(key);
              lines.push([starMap[starA.name], starMap[nameB]]);
            });
          });
          return lines.map((line, i) => (
            <Polyline
              key={i}
              positions={line}
              pathOptions={{
                color: '#fff',
                weight: 6,
                opacity: 0.95,
                dashArray: undefined,
              }}
            />
          ));
        }
        return null;
      })()}
      {stars.map((star, i) => {
        const isZenith = i === zenithIdx;
        // Color and size logic from Gaia BP-RP and Gmag
        const bp_rp = star.bp_rp ?? 1.0;
        const gmag = star.phot_g_mean_mag ?? 20;
        const temp = bpRpToTemperature(bp_rp);
        const [r, g, b] = temperatureToRGB(temp);
        const color = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
        // Visible marker size
        const visibleRadius = computeStarSize(gmag) * 1.5;
        // Hitbox marker size (invisible)
        const hitboxRadius = computeStarSize(gmag) * 2.5;
        const center = [
          (star.base_lat || 0) + (star.alt_diff || 0),
          (star.base_lng || 0) + (star.az_diff || 0),
        ];
        return (
          <React.Fragment key={i}>
            {/* Large transparent hitbox marker for easier clicking */}
            <CircleMarker
              center={center}
              pathOptions={{
                color: 'transparent',
                fillColor: 'transparent',
                fillOpacity: 0,
                opacity: 0,
                weight: 0,
                radius: hitboxRadius,
              }}
              eventHandlers={{
                click: isZenith && setZenithPopupOpen ? () => setZenithPopupOpen(true) : undefined
              }}
            />
            {/* Visible star marker */}
          <CircleMarker
              center={center}
            pathOptions={{
              color,
              weight: 2,
              fillOpacity: 0.95,
              opacity: 1,
              fillColor: color,
                radius: visibleRadius,
            }}
            eventHandlers={isZenith && setZenithPopupOpen ? {
              click: () => setZenithPopupOpen(true)
            } : undefined}
              // Optionally, set interactive={false} if you want only the hitbox to be clickable
          >
            {(isZenith && zenithPopupOpen) || !isZenith ? (
              <Popup 
                  position={center}
                eventHandlers={isZenith && setZenithPopupOpen ? { remove: () => setZenithPopupOpen(false) } : undefined}
              >
                <div style={{ minWidth: 220, color: '#f4faff', padding: 6 }}>
                  {star.designation && (
                    <div style={{ fontWeight: 700, fontSize: '1.1em', marginBottom: 6 }}>
                      {star.designation}
                    </div>
                  )}
                  <div><b>G:</b> {star.phot_g_mean_mag?.toFixed(2)}</div>
                  <div><b>BP-RP:</b> {star.bp_rp?.toFixed(2)}</div>
                  {star.parallax && star.parallax > 0 && (
                    <div><b>Distance:</b> {(1000 / star.parallax).toFixed(2)} pc</div>
                  )}
                  <button
                    style={{ marginTop: 12 }}
                    onClick={async () => {
                      let subtitle = '';
                      if (selectedDate && star.base_lat && star.base_lng) {
                        const location = await fetchLocationName(star.base_lat, star.base_lng);
                        const dateStr = selectedDate.toLocaleString(undefined, {
                          year: 'numeric', month: 'long', day: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        });
                        subtitle = `${dateStr} – ${location}`;
                      }
                      fetchStarPDF({ ...star, subtitle });
                    }}
                  >
                    Download PDF
                  </button>
                </div>
              </Popup>
            ) : null}
          </CircleMarker>
          </React.Fragment>
        );
      })}
    </>
  );
};

export default StarOverlay; 
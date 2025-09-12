// Leaflet map wrapper used by the main app. Emits clicks as lat/lon pairs
// and renders any passed children (e.g., star overlays).
import React, { forwardRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import * as L from 'leaflet';

// Fix Leaflet marker icon paths for production (public/)
(L.Icon as any)['Default'].mergeOptions({
  iconRetinaUrl: '/marker-icon-2x.png',
  iconUrl: '/marker-icon.png',
  shadowUrl: '/marker-shadow.png',
});

interface MapSelectorProps {
  onLocationSelect: (coords: [number, number]) => void;
  selectedLocation: [number, number] | null;
  disabled?: boolean;
  children?: React.ReactNode;
}

const DEFAULT_POSITION: [number, number] = [41.35168556332073, 2.1116924285888676];

const LocationMarker: React.FC<{ onSelect: (coords: [number, number]) => void; selected: [number, number] | null }> = ({ onSelect, selected }) => {
  useMapEvents({
    click(e) {
      onSelect([e.latlng.lat, e.latlng.lng]);
    },
  });
  return selected ? <Marker position={selected} /> : null;
};

const MapSelector = forwardRef<any, MapSelectorProps>(({ onLocationSelect, selectedLocation, children, disabled }, ref) => {
  // Wrap onLocationSelect to prevent selection when disabled
  const handleSelect = (coords: [number, number]) => {
    if (!disabled) {
      onLocationSelect(coords);
    }
  };
  // react-leaflet types can mismatch across versions; cast components to any to avoid noise
  const AnyMapContainer: any = MapContainer as any;
  const AnyTileLayer: any = TileLayer as any;
  return (
    <AnyMapContainer ref={ref} center={selectedLocation || DEFAULT_POSITION} zoom={10} style={{ height: '100vh', width: '100vw' }}>
      <AnyTileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <LocationMarker onSelect={handleSelect} selected={selectedLocation} />
      {children}
    </AnyMapContainer>
  );
});

export default MapSelector; 
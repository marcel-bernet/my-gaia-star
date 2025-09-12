/**
 * Main application shell.
 *
 * Manages navigation between the home view and the map, user settings,
 * geolocation, calling the backend, and rendering star overlays.
 */
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import SettingsModal, { StarSettings } from './components/SettingsModal';
import { Cog6ToothIcon, HomeIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import InfoModal from './components/InfoModal';
import HomePage from './components/HomePage';
import AboutModal from './components/AboutModal';
import { useGeolocation } from './hooks/useGeolocation';
import './App.css';
import MapSelector from './components/MapSelector';
import StarOverlay from './components/StarOverlay';
import Loader from './components/Loader';
import { fetchStars, fetchStarPDF } from './api/gaiamaps';
import { StarData } from './types/star';
import TutorialModal from './components/TutorialModal';

const DEFAULT_POSITION = [41.35168556332073, 2.1116924285888676];
// Copy shown after finding the zenith star
const EPIC_MESSAGE = `You are probably the first human in all of history to ever contemplate this star from this place, at this moment. The universe is vast, and tonight, this star belongs to you.`;

type Mode = 'aboveYou' | 'specialStar';

const App: React.FC = () => {
  const hasAutoCenteredRef = useRef(false);
  const mapRef = useRef<any>(null);

  const [view, setView] = useState<'home' | 'map'>('home');
  const [mode, setMode] = useState<Mode>('aboveYou');

  const { t } = useTranslation();
  const [selectedLocation, setSelectedLocation] = useState<[number, number] | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [stars, setStars] = useState<StarData[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [settings, setSettings] = useState<StarSettings>({ brightnessMode: 'all', includeVelocity: false, includeDistance: true });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [zenithStar, setZenithStar] = useState<StarData | null>(null);
  const [zenithPopupOpen, setZenithPopupOpen] = useState(false);
  const [epicMessage, setEpicMessage] = useState<string | null>(null);

  const [isAboutModalOpen, setAboutModalOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);

  const [dateInput, setDateInput] = useState('2025-07-28');
  const [hourInput, setHourInput] = useState('12');
  const [minuteInput, setMinuteInput] = useState('29');

  const { location, permissionDenied, requestLocation } = useGeolocation();

  useEffect(() => {
    if (view === 'map' && mode === 'aboveYou') {
        requestLocation();
    }
  }, [view, mode, requestLocation]);

  useEffect(() => {
    if (mode === 'aboveYou' && location) {
      if (!selectedLocation || selectedLocation[0] !== location[0] || selectedLocation[1] !== location[1]) {
        setSelectedLocation(location);
        hasAutoCenteredRef.current = false; // Reset auto-center when location changes
      }
    }
  }, [mode, location, selectedLocation]);

  const handleNavigate = (selectedMode: Mode) => {
    setMode(selectedMode);
    setView('map');
    setStars([]);
    setZenithStar(null);
    setEpicMessage(null);
    setError(null);
  };

  const handleMapClick = (latlng: [number, number]) => {
    if (mode === 'aboveYou' && permissionDenied === false) {
      return; // In 'aboveYou' mode with location permission, map clicks are disabled
    }
    setSelectedLocation(latlng);
  };

  // Query the backend for stars above the selected location/date
  const handleGetStars = async () => {
    if (!selectedLocation) {
      setError('Please select a location on the map.');
      return;
    }

    setLoading(true);
    setError(null);
    setEpicMessage(null);

    try {
      if (mode === 'aboveYou' && mapRef.current && !hasAutoCenteredRef.current) {
        mapRef.current.flyTo(selectedLocation, 12, { animate: true, duration: 1.2 });
        await new Promise(res => setTimeout(res, 1200));
        hasAutoCenteredRef.current = true;
      }

      const dateToUse = mode === 'aboveYou' ? new Date() : new Date(`${dateInput}T${hourInput}:${minuteInput}`);
      setSelectedDate(dateToUse);

      const data = await fetchStars(selectedLocation, dateToUse, settings);
      setStars(data.stars);

      let zenith: StarData | null = null;
      if (data.stars.length > 0) {
        let minDist = Infinity;
        const [lat, lng] = selectedLocation;
        const latRad = lat * Math.PI / 180;
        const lngRad = lng * Math.PI / 180;

        for (const star of data.stars) {
          if (star.ra == null || star.dec == null) continue;
          const raRad = (star.ra * 15) * Math.PI / 180;
          const decRad = star.dec * Math.PI / 180;
          const d = Math.acos(
            Math.sin(latRad) * Math.sin(decRad) +
            Math.cos(latRad) * Math.cos(decRad) * Math.cos(lngRad - raRad)
          );
          if (d < minDist) {
            minDist = d;
            zenith = star;
          }
        }
        setZenithStar(zenith);
        setZenithPopupOpen(true);
        setEpicMessage(EPIC_MESSAGE);
      }

    } catch (e) {
      setError('Failed to fetch stars. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {view === 'home' ? (
        <HomePage onNavigate={handleNavigate} onAbout={() => setAboutModalOpen(true)} />
      ) : (
        <div className="fixed inset-0 min-h-screen h-screen w-full bg-gray-100 flex flex-col overflow-hidden">
          <div style={{ zIndex: 0 }}>
            <MapSelector onLocationSelect={handleMapClick} selectedLocation={selectedLocation} ref={mapRef}>
              <StarOverlay stars={stars} fetchStarPDF={fetchStarPDF} zenithStar={zenithStar} zenithPopupOpen={zenithPopupOpen} setZenithPopupOpen={setZenithPopupOpen} selectedDate={selectedDate} />
            </MapSelector>
          </div>

          
          {loading && <Loader />}

          {/* UI Elements */}
          {/* Top-right stacked controls */}
          <div className="fixed top-3 right-3 md:top-6 md:right-6 z-[300] flex flex-col items-end gap-3">
            <button
              className="bg-[rgba(30,34,54,0.7)] p-2 rounded-full shadow text-white hover:bg-[rgba(30,34,54,0.95)] focus:outline-none"
              onClick={() => setView('home')}
              aria-label="Home"
            >
              <HomeIcon className="h-5 w-5" />
            </button>
            <button
              className="bg-[rgba(30,34,54,0.7)] p-2 rounded-full shadow text-white hover:bg-[rgba(30,34,54,0.95)] focus:outline-none"
              onClick={() => setInfoOpen(true)}
              aria-label="Help"
            >
              <QuestionMarkCircleIcon className="h-5 w-5" />
            </button>
            <button
              className="bg-[rgba(30,34,54,0.7)] p-2 rounded-full shadow text-white hover:bg-[rgba(30,34,54,0.95)] focus:outline-none"
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
            >
              <Cog6ToothIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[202] flex flex-col items-center w-full min-w-0">
            {mode === 'specialStar' && (
              <div className="flex gap-2 w-full max-w-xs mb-4">
                <input
                  type="date"
                  className="flex-1 rounded-lg border border-sky-400 shadow focus:outline-none focus:ring-2 focus:ring-sky-400 text-gray-900 bg-white px-2 py-1"
                  value={dateInput}
                  onChange={e => setDateInput(e.target.value)}
                />
                <select
                  className="w-16 rounded-lg border-sky-400 shadow focus:outline-none focus:ring-2 focus:ring-sky-400 text-gray-900 bg-white px-2 py-1"
                  value={hourInput}
                  onChange={e => setHourInput(e.target.value)}
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={String(i).padStart(2, '0')}>{String(i).padStart(2, '0')}</option>
                  ))}
                </select>
                <select
                  className="w-16 rounded-lg border-sky-400 shadow focus:outline-none focus:ring-2 focus:ring-sky-400 text-gray-900 bg-white px-2 py-1"
                  value={minuteInput}
                  onChange={e => setMinuteInput(e.target.value)}
                >
                  {Array.from({ length: 60 }, (_, i) => (
                    <option key={i} value={String(i).padStart(2, '0')}>{String(i).padStart(2, '0')}</option>
                  ))}
                </select>
              </div>
            )}
            {mode === 'aboveYou' && !location && permissionDenied && (
               <div className="mb-2 text-lg font-semibold text-gray-800 bg-white/80 px-6 py-3 rounded-xl shadow">{t('map.click_location')}</div>
             )}
            
          <button
              className="action-btn w-full max-w-xs font-bold rounded-xl border-none shadow-lg text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-yellow-300 disabled:opacity-60 leading-none whitespace-nowrap truncate overflow-hidden block"
              style={{ background: 'linear-gradient(90deg, #fde047 0%, #ec4899 100%)', lineHeight: '1', padding: '1rem', boxSizing: 'border-box' }}
              onMouseOver={e => (e.currentTarget.style.background = 'linear-gradient(90deg, #ec4899 0%, #fde047 100%)')}
              onMouseOut={e => (e.currentTarget.style.background = 'linear-gradient(90deg, #fde047 0%, #ec4899 100%)')}
              onClick={handleGetStars}
              disabled={loading || !selectedLocation}
            >
              {t('map.get_stars')}
            </button>
          </div>

        </div>
      )}
      <AboutModal isOpen={isAboutModalOpen} onClose={() => setAboutModalOpen(false)} />
      {tutorialStep !== null && (
        <TutorialModal
            step={tutorialStep}
            onNext={() => {
              if (tutorialStep < 2) setTutorialStep(tutorialStep + 1);
              else setTutorialStep(null);
            }}
            onSkip={() => setTutorialStep(null)}
        />
      )}
      {/* Info modal */}
      <InfoModal
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        title={t('info.title')}
        message={mode === 'aboveYou' ? t('info.above_you') : t('info.special_star')}
      />
      {/* Settings modal */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onApply={setSettings}
      />
    </>
  );
};

export default App;

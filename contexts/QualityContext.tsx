'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { QualityPreset, QualitySettings, QUALITY_PRESETS, DEFAULT_QUALITY } from '@/lib/config/quality';

interface QualityContextType {
  preset: QualityPreset;
  settings: QualitySettings;
  setPreset: (preset: QualityPreset) => void;
  /** Experimental SSGI/TRAA runtime toggle (only honored where settings.experimentalSSGI allows it) */
  ssgiEnabled: boolean;
  setSsgiEnabled: (enabled: boolean) => void;
}

const QualityContext = createContext<QualityContextType | undefined>(undefined);

const STORAGE_KEY = 'car-quality-preset';
const SSGI_STORAGE_KEY = 'car-experimental-ssgi';

export function QualityProvider({ children }: { children: ReactNode }) {
  const [preset, setPresetState] = useState<QualityPreset>(DEFAULT_QUALITY);
  const [settings, setSettings] = useState<QualitySettings>(QUALITY_PRESETS[DEFAULT_QUALITY]);
  const [ssgiEnabled, setSsgiEnabledState] = useState(false);

  // Load from localStorage on mount; first visit on a phone defaults to low
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in QUALITY_PRESETS) {
      const loadedPreset = stored as QualityPreset;
      setPresetState(loadedPreset);
      setSettings(QUALITY_PRESETS[loadedPreset]);
    } else if (window.innerWidth < 768) {
      setPresetState('low');
      setSettings(QUALITY_PRESETS.low);
    }
    setSsgiEnabledState(localStorage.getItem(SSGI_STORAGE_KEY) === '1');
  }, []);

  const setPreset = (newPreset: QualityPreset) => {
    setPresetState(newPreset);
    setSettings(QUALITY_PRESETS[newPreset]);
    localStorage.setItem(STORAGE_KEY, newPreset);
  };

  const setSsgiEnabled = (enabled: boolean) => {
    setSsgiEnabledState(enabled);
    localStorage.setItem(SSGI_STORAGE_KEY, enabled ? '1' : '0');
  };

  return (
    <QualityContext.Provider value={{ preset, settings, setPreset, ssgiEnabled, setSsgiEnabled }}>
      {children}
    </QualityContext.Provider>
  );
}

// Read-only defaults for consumers rendered outside a provider (e.g. the
// homepage hero embeds ConfigurableCar without one — throwing here crashed
// its whole canvas). Setters are no-ops; the /car page always has the
// real provider.
const FALLBACK_QUALITY: QualityContextType = {
  preset: DEFAULT_QUALITY,
  settings: QUALITY_PRESETS[DEFAULT_QUALITY],
  setPreset: () => {},
  ssgiEnabled: false,
  setSsgiEnabled: () => {},
};

export function useQuality() {
  return useContext(QualityContext) ?? FALLBACK_QUALITY;
}

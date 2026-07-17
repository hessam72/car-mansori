'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { QualityPreset, QualitySettings, QUALITY_PRESETS, DEFAULT_QUALITY } from '@/lib/config/quality';

interface QualityContextType {
  preset: QualityPreset;
  settings: QualitySettings;
  setPreset: (preset: QualityPreset) => void;
}

const QualityContext = createContext<QualityContextType | undefined>(undefined);

const STORAGE_KEY = 'car-quality-preset';

export function QualityProvider({ children }: { children: ReactNode }) {
  const [preset, setPresetState] = useState<QualityPreset>(DEFAULT_QUALITY);
  const [settings, setSettings] = useState<QualitySettings>(QUALITY_PRESETS[DEFAULT_QUALITY]);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in QUALITY_PRESETS) {
      const loadedPreset = stored as QualityPreset;
      setPresetState(loadedPreset);
      setSettings(QUALITY_PRESETS[loadedPreset]);
    }
  }, []);

  const setPreset = (newPreset: QualityPreset) => {
    setPresetState(newPreset);
    setSettings(QUALITY_PRESETS[newPreset]);
    localStorage.setItem(STORAGE_KEY, newPreset);
  };

  return (
    <QualityContext.Provider value={{ preset, settings, setPreset }}>
      {children}
    </QualityContext.Provider>
  );
}

export function useQuality() {
  const context = useContext(QualityContext);
  if (context === undefined) {
    throw new Error('useQuality must be used within a QualityProvider');
  }
  return context;
}

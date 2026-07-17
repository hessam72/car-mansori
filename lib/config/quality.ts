export type QualityPreset = 'low' | 'medium' | 'high' | 'ultra';

export interface QualitySettings {
  dpr: [number, number];
  adaptiveDpr: boolean;
  shadowResolution: number;
  floorReflectionResolution: number;
  meshReflectorResolution: number;
  multisampling: number;
  enableN8AO: boolean;
  enableSMAA: boolean;
  enableAnisotropicFiltering: boolean;
  anisotropyLevel: number;
}

export const QUALITY_PRESETS: Record<QualityPreset, QualitySettings> = {
  low: {
    dpr: [0.5, 1],
    adaptiveDpr: true,
    shadowResolution: 256,
    floorReflectionResolution: 128,
    meshReflectorResolution: 512,
    multisampling: 0,
    enableN8AO: false,
    enableSMAA: false,
    enableAnisotropicFiltering: false,
    anisotropyLevel: 1,
  },
  medium: {
    dpr: [1, 1.5],
    adaptiveDpr: true,
    shadowResolution: 512,
    floorReflectionResolution: 256,
    meshReflectorResolution: 1024,
    multisampling: 0,
    enableN8AO: false,
    enableSMAA: false,
    enableAnisotropicFiltering: false,
    anisotropyLevel: 1,
  },
  high: {
    dpr: [1, 1.75],
    adaptiveDpr: false,
    shadowResolution: 1024,
    floorReflectionResolution: 512,
    meshReflectorResolution: 1024,
    multisampling: 4,
    enableN8AO: true,
    enableSMAA: true,
    enableAnisotropicFiltering: true,
    anisotropyLevel: 4,
  },
  ultra: {
    dpr: [1, 2],
    adaptiveDpr: false,
    shadowResolution: 2048,
    floorReflectionResolution: 2048,
    meshReflectorResolution: 2048,
    multisampling: 8,
    enableN8AO: true,
    enableSMAA: true,
    enableAnisotropicFiltering: true,
    anisotropyLevel: 16,
  },
};

export const DEFAULT_QUALITY: QualityPreset = 'medium';

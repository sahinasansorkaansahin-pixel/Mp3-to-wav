
export interface EQBand {
  frequency: number;
  gain: number; // -12 to 12
}

export interface CompressorSettings {
  threshold: number; // -60 to 0 dB
  ratio: number; // 0 to 20 (mapped)
  attack: number; // 0 to 1 s
  release: number; // 0 to 1 s
}

export interface ReverbSettings {
  mix: number; // 0 to 1 (Dry/Wet)
  decay: number; // 0.1 to 10s
}

export interface AudioState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  fileName: string;
  isLoaded: boolean;
}

export interface MasteringSettings {
  masterGain: number; // 0 to 2
  eq: EQBand[];
  compressor: CompressorSettings;
  reverb: ReverbSettings;
  // New Professional Enhancements
  saturation: number; // 0 to 1
  air: number; // 0 to 12
  body: number; // 0 to 6
  stereoWidth: number; // 0 to 2
  ceiling: number; // -10 to 0
  stereoBass: number; // 0 to 12 dB
  dynamicBass: number; // 0 to 12 dB
  softClip: number; // 0 to 1
}

export type PresetName = 'Manual' | 'Pop' | 'Rap' | 'Rock' | 'Anatolian Rock' | 'Acoustic' | 'Vocal' | 'Arabesk' | 'Slow';

export interface Preset {
  name: PresetName;
  description: string;
  settings: MasteringSettings;
}

export enum SampleRate {
  SR_44100 = 44100,
  SR_48000 = 48000,
  SR_96000 = 96000,
}

export enum BitDepth {
  BIT_16 = 16,
  BIT_24 = 24,
}

export enum ExportFormat {
  WAV_16 = '16-Bit PCM',
  WAV_24 = '24-Bit PCM',
  WAV_32 = '32-Bit Float',
}

export interface AnalysisResult {
  rms: number;
  crestFactor: number;
  spectralFlux: number;
  musicalKey: string;
  musicalScale: string;
  bpm: number;
  spectralBalance: number[];
  lowEnergy: number;
  midEnergy: number;
}

export interface AiDecisionResult {
  settings: MasteringSettings;
  logs: string[];
}

import { EQBand, MasteringSettings, Preset } from './types';

export const DEFAULT_EQ_FREQUENCIES = [
  30, 60, 120, 240, 500, 
  1000, 2000, 4000, 8000, 
  12000, 16000, 20000, 26000, 32000
];

export const DEFAULT_SETTINGS: MasteringSettings = {
  masterGain: 0, // Unity
  eq: DEFAULT_EQ_FREQUENCIES.map((f) => ({ frequency: f, gain: 0 })),
  compressor: {
    threshold: 0, 
    ratio: 0,     
    attack: 0,    
    release: 0,   
  },
  reverb: {
    mix: 0,
    decay: 2.0,
  },
  saturation: 0,
  air: 0,
  body: 0,
  stereoWidth: 0, 
  ceiling: 0, 
  stereoBass: 0,
  dynamicBass: 0,
  softClip: 0,
};

export const ANALYZER_FFT_SIZE = 4096;
export const SMOOTHING_TIME_CONSTANT = 0.85;

// Helper to create EQ curve quickly
const createEQ = (gains: number[]) => {
    return DEFAULT_EQ_FREQUENCIES.map((f, i) => ({
        frequency: f,
        gain: gains[i] || 0
    }));
};

export const PRESETS: Record<string, Preset> = {
    'Pop': {
        name: 'Pop',
        description: 'Radio-ready polish. Balanced highs and tight lows.',
        settings: {
            ...DEFAULT_SETTINGS,
            masterGain: 0.10, // Controlled gain
            eq: createEQ([0, 1, 0, -1, -2, -1, 0, 1, 2, 2, 2, 1, 0, 0]),
            compressor: { threshold: -15, ratio: 2.5, attack: 0.01, release: 0.1 },
            saturation: 0.02,
            air: 2.0,
            body: 1.0,
            stereoWidth: 0.10,
            ceiling: -0.2,
            dynamicBass: 1.0, // Subtle punch
            softClip: 0.1
        }
    },
    'Rap': {
        name: 'Rap',
        description: 'Heavy kick, clear vocals, hard limiting.',
        settings: {
            ...DEFAULT_SETTINGS,
            masterGain: 0.05, // Low output gain to compensate for massive bass boosts
            eq: createEQ([2, 3, 1, 0, -1, 0, 1, 2, 3, 3, 1, 0, 0, 0]),
            compressor: { threshold: -16, ratio: 4.0, attack: 0.005, release: 0.05 }, // Fast attack to control kick
            saturation: 0.04, // Grit
            air: 1.5,
            body: 0.5,
            dynamicBass: 3.0, // Strong Punch at 65Hz
            stereoBass: 0.5, // Subtle width in lows
            ceiling: -0.1,
            softClip: 0.3
        }
    },
    'Rock': {
        name: 'Rock',
        description: 'Aggressive guitars, punchy drums, solid power.',
        settings: {
            ...DEFAULT_SETTINGS,
            masterGain: 0.08,
            eq: createEQ([1, 2, 1, 0, -1, 0, 2, 3, 3, 2, 1, 0, 0, 0]), // V-Shape
            compressor: { threshold: -14, ratio: 3.5, attack: 0.01, release: 0.1 },
            saturation: 0.05, // Tube distortion
            body: 1.5, // Guitar body
            air: 1.5, // Cymbal sheen
            dynamicBass: 1.5, // Kick punch
            stereoWidth: 0.15,
            ceiling: -0.1,
            softClip: 0.25
        }
    },
    'Anatolian Rock': {
        name: 'Anatolian Rock',
        description: 'Psychedelic 70s vibe. Driving bass rhythm, vintage warmth.',
        settings: {
            ...DEFAULT_SETTINGS,
            masterGain: 0.12,
            eq: createEQ([2, 3, 2, 1, 0, 1, 2, 2, 1, 1, 0, 0, 0, 0]), // Boosted low-mids for rhythm
            compressor: { threshold: -13, ratio: 2.5, attack: 0.02, release: 0.2 }, // Vintage squeeze
            saturation: 0.08, // High warmth/fuzz
            body: 3.0, // Full body
            stereoBass: 2.0, // Wide bass as requested
            dynamicBass: 3.5, // Strong rhythmic pulse
            reverb: { mix: 0.2, decay: 2.0 }, // Psychedelic atmosphere
            air: 1.0,
            stereoWidth: 0.2, // Wide stage
            softClip: 0.2
        }
    },
    'Acoustic': {
        name: 'Acoustic',
        description: 'Dynamic, open, minimal coloring.',
        settings: {
            ...DEFAULT_SETTINGS,
            masterGain: 0.0,
            eq: createEQ([0, 0, -1, -1, 0, 0, 1, 1, 2, 1, 0, 0, 0, 0]),
            compressor: { threshold: -10, ratio: 1.5, attack: 0.02, release: 0.2 },
            reverb: { mix: 0.1, decay: 1.5 },
            air: 1.0,
            stereoWidth: 0.05,
            saturation: 0.01,
            body: 1.0
        }
    },
    'Vocal': {
        name: 'Vocal',
        description: 'Mid-forward, de-essed highs, vocal presence.',
        settings: {
            ...DEFAULT_SETTINGS,
            masterGain: 0.1,
            eq: createEQ([-2, -1, -1, 0, 2, 3, 3, 0, 1, 2, 1, 0, 0, 0]), // Dip at 4k/8k for de-essing
            compressor: { threshold: -18, ratio: 2.5, attack: 0.01, release: 0.15 },
            body: 2.5, // Warmth
            air: 2.0,
            reverb: { mix: 0.15, decay: 2.0 },
            stereoWidth: 0.0,
            softClip: 0.1
        }
    },
    'Arabesk': {
        name: 'Arabesk',
        description: 'Emotional, wide stereo field, warm mids.',
        settings: {
            ...DEFAULT_SETTINGS,
            masterGain: 0.12,
            eq: createEQ([1, 2, 2, 1, 2, 2, 1, 0, 0, 1, 0, 0, 0, 0]),
            compressor: { threshold: -14, ratio: 3.0, attack: 0.02, release: 0.3 },
            reverb: { mix: 0.30, decay: 3.0 }, // Lush reverb
            body: 4.0, // High warmth
            stereoWidth: 0.30, // Very Wide
            stereoBass: 1.5, // Wide bass
            saturation: 0.05 // Analog warmth
        }
    },
    'Slow': {
        name: 'Slow',
        description: 'Glue compression, dark vintage tone.',
        settings: {
            ...DEFAULT_SETTINGS,
            masterGain: 0.1,
            eq: createEQ([1, 1, 1, 0, 0, -0.5, -1, -1, -0.5, 0, 0, 0, 0, 0]),
            compressor: { threshold: -12, ratio: 2.0, attack: 0.05, release: 0.5 }, // Slow release
            saturation: 0.06, // Tape feel
            body: 3.0,
            reverb: { mix: 0.20, decay: 2.5 },
            softClip: 0.2,
            air: 0.5
        }
    },
    'Manual': {
        name: 'Manual',
        description: 'Reset all settings. You are in control.',
        settings: DEFAULT_SETTINGS
    }
};
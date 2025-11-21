
import { AnalysisResult, MasteringSettings, AiDecisionResult } from '../types';
import { DEFAULT_SETTINGS } from '../constants';

export const generateAiSettings = (analysis: AnalysisResult): AiDecisionResult => {
  const settings: MasteringSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  const logs: string[] = [];
  
  const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));

  // --- PROFESSIONAL METRICS CALCULATION ---
  // Using the new Gated RMS from AudioEngine which excludes quiet intros/outros
  const estimatedLUFS = (20 * Math.log10(analysis.rms)) - 0.6;
  
  const dynamicRange = analysis.crestFactor; 
  const spectralFlux = analysis.spectralFlux; 

  logs.push(`> ANALYSIS COMPLETE: Fusion V4.1 Gated Scan.`);
  logs.push(`> MUSICAL CONTEXT: ${analysis.musicalKey} ${analysis.musicalScale} @ ${analysis.bpm} BPM`);
  logs.push(`> SIGNAL PATH: Input Gated LUFS=${estimatedLUFS.toFixed(1)} | Dyn Range=${dynamicRange.toFixed(1)}`);

  // --- 1. SPECTRAL CURVE MATCHING ---
  const targetCurve = [
     0.95, 0.90, 0.85, 0.80, // Bass
     0.75, 0.70, 0.65, 0.60, // Low Mids
     0.55, 0.50, 0.45, 0.40, // High Mids
     0.35, 0.30 // Air
  ];

  let eqLog = "> EQ: ";
  settings.eq.forEach((band, i) => {
      if (analysis.spectralBalance[i] === undefined) return;

      const actual = analysis.spectralBalance[i];
      const target = targetCurve[i] || 0.5;
      const delta = actual - target;
      let gain = delta * -12.0; // Reduced aggression from -14 to -12

      // Safety clamps
      if (band.frequency < 100) {
          gain = clamp(gain, -3, 3); 
      } else if (band.frequency > 8000) {
          gain = clamp(gain, -4, 4); 
      } else {
          gain = clamp(gain, -3, 3); 
      }
      settings.eq[i].gain = parseFloat(gain.toFixed(1));
  });
  logs.push(`${eqLog}Balanced freq response.`);

  // --- 2. IMAGING & BASS CONTROL ---
  // Scale is now 0-based offset. 
  settings.stereoWidth = 0.15; 
  
  // New: Stereo Bass Logic
  // If bass is strong, we can widen it slightly for atmosphere.
  if (analysis.lowEnergy > 0.6) {
      settings.stereoBass = 2.0; // Slight stereo width on bass
  }

  // New: Dynamic Bass Logic
  // If bass is weak, boost the dynamic punch node
  if (analysis.lowEnergy < 0.4) {
      settings.dynamicBass = 3.0; // Add punch @ 60Hz
      logs.push(`> LOW END: Bass weak. Adding Dynamic Punch.`);
  }

  if (analysis.midEnergy > analysis.lowEnergy * 1.5) {
      // Thin track, widen it slightly less to avoid phase issues
      settings.stereoWidth = 0.05;
  }

  // --- 3. SATURATION (Texture) ---
  if (spectralFlux < 12) {
      settings.saturation = 0.04;
      settings.body = 1.5;
      logs.push(`> COLOR: Low spectral movement. Adding harmonic excitement.`);
  } else {
      settings.saturation = 0.01;
      settings.body = 0.0;
  }

  // --- 4. LOUDNESS & DYNAMICS TARGETING ---
  let targetLUFS = -10.0; 
  if (estimatedLUFS > -12) targetLUFS = estimatedLUFS; 
  if (estimatedLUFS < -24) targetLUFS = -13.0; 

  const gainNeeded = targetLUFS - estimatedLUFS;
  
  if (gainNeeded > 0.5) {
      const linearGainDb = Math.min(gainNeeded, 4.0); 
      const saturatorGainDb = Math.max(0, gainNeeded - linearGainDb); 

      const linearRatio = Math.pow(10, linearGainDb / 20);
      
      settings.masterGain = clamp(linearRatio - 1.0, 0.0, 0.8); 
      settings.ceiling = -0.3;

      let softClipAmount = clamp(saturatorGainDb * 0.08, 0, 0.4);
      
      if (dynamicRange > 4.0) {
          softClipAmount += 0.1;
          logs.push(`> DYNAMICS: High crest factor detected. Taming peaks with Soft Clip.`);
      }

      settings.softClip = parseFloat(softClipAmount.toFixed(2));
      
      logs.push(`> LOUDNESS: Gain +${linearGainDb.toFixed(1)}dB. Density +${saturatorGainDb.toFixed(1)}dB via Clipper.`);

      if (gainNeeded > 3) {
          settings.compressor.threshold = -16;
          settings.compressor.ratio = 2.0;
          settings.compressor.attack = 0.010;
          settings.compressor.release = 0.15;
      }
  } else {
      settings.masterGain = 0.0; // Unity
      settings.softClip = 0.05; // Minimal color
      logs.push(`> LOUDNESS: Track is optimal (-${Math.abs(estimatedLUFS).toFixed(1)} LUFS).`);
  }

  return { settings, logs };
};

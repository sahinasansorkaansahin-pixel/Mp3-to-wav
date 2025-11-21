
import { MasteringSettings } from '../types';
import { ANALYZER_FFT_SIZE, SMOOTHING_TIME_CONSTANT } from '../constants';

class AudioEngine {
  private audioContext: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private audioBuffer: AudioBuffer | null = null;
  
  // Nodes
  private gainNode: GainNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private eqNodes: BiquadFilterNode[] = [];
  private reverbNode: ConvolverNode | null = null;
  private reverbToneNode: BiquadFilterNode | null = null;
  private wetGainNode: GainNode | null = null;
  private dryGainNode: GainNode | null = null;
  private analyzerNode: AnalyserNode | null = null;

  // Enhancements
  private saturationNode: WaveShaperNode | null = null;
  private airNode: BiquadFilterNode | null = null;
  private bodyNode: BiquadFilterNode | null = null;
  private limiterNode: DynamicsCompressorNode | null = null;
  private msSideGainNode: GainNode | null = null;

  // New Output Nodes
  private stereoBassNode: BiquadFilterNode | null = null; // Used on Side Channel
  private dynamicBassNode: BiquadFilterNode | null = null; // Used on Main Channel for punch
  private softClipNode: WaveShaperNode | null = null;

  private impulseResponseCache: AudioBuffer | null = null;
  private lastDecayValue: number = -1;

  private startTime: number = 0;
  private pausedAt: number = 0;
  private isPlaying: boolean = false;

  constructor() {}

  private initContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  public async resumeContext() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
    }
  }

  private makeDistortionCurve(amount: number) {
    const n_samples = 4096;
    const curve = new Float32Array(n_samples);
    const drive = amount * 10.0; // Increased multiplier for more audible effect at low values
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      // Soft knee tape saturation emulation
      if (drive === 0) curve[i] = x;
      else curve[i] = (Math.PI + drive) * x / (Math.PI + drive * Math.abs(x));
    }
    return curve;
  }

  private makeSoftClipCurve(amount: number) {
    const n_samples = 4096;
    const curve = new Float32Array(n_samples);
    for (let i = 0; i < n_samples; ++i) {
        const x = (i * 2) / n_samples - 1;
        if (amount === 0) {
            curve[i] = x;
        } else {
            // Sigmoid function for smooth limiting
            const k = 1 + amount * 2;
            curve[i] = Math.tanh(k * x) / Math.tanh(k);
        }
    }
    return curve;
  }

  private createImpulseResponse(ctx: BaseAudioContext, duration: number, decay: number, reverse: boolean): AudioBuffer {
    if (ctx === this.audioContext && this.impulseResponseCache && Math.abs(this.lastDecayValue - decay) < 0.01) {
        return this.impulseResponseCache;
    }
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = reverse ? length - i : i;
      let e = Math.pow(1 - n / length, decay);
      const noiseL = (Math.random() * 2 - 1);
      const noiseR = (Math.random() * 2 - 1);
      left[i] = noiseL * e;
      right[i] = noiseR * e;
    }

    if (ctx === this.audioContext) {
        this.impulseResponseCache = impulse;
        this.lastDecayValue = decay;
    }
    return impulse;
  }

  public async loadFile(file: File): Promise<AudioBuffer> {
    this.initContext();
    const arrayBuffer = await file.arrayBuffer();
    this.audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
    return this.audioBuffer;
  }

  public setupGraph(settings: MasteringSettings) {
    if (!this.audioContext || !this.audioBuffer) return;

    // Disconnect everything first
    this.sourceNode?.disconnect();
    this.gainNode?.disconnect();
    this.compressorNode?.disconnect();
    this.analyzerNode?.disconnect();
    this.reverbNode?.disconnect();
    this.reverbToneNode?.disconnect();
    this.wetGainNode?.disconnect();
    this.dryGainNode?.disconnect();
    this.saturationNode?.disconnect();
    this.airNode?.disconnect();
    this.bodyNode?.disconnect();
    this.limiterNode?.disconnect();
    this.msSideGainNode?.disconnect();
    this.stereoBassNode?.disconnect();
    this.dynamicBassNode?.disconnect();
    this.softClipNode?.disconnect();
    this.eqNodes.forEach(node => node.disconnect());
    this.eqNodes = [];

    // Create Nodes
    this.gainNode = this.audioContext.createGain();
    this.compressorNode = this.audioContext.createDynamicsCompressor();
    this.analyzerNode = this.audioContext.createAnalyser();
    this.analyzerNode.fftSize = ANALYZER_FFT_SIZE;
    this.analyzerNode.smoothingTimeConstant = SMOOTHING_TIME_CONSTANT;

    this.saturationNode = this.audioContext.createWaveShaper();
    this.saturationNode.curve = this.makeDistortionCurve(settings.saturation);
    this.saturationNode.oversample = '4x';

    this.softClipNode = this.audioContext.createWaveShaper();
    this.softClipNode.curve = this.makeSoftClipCurve(settings.softClip);
    this.softClipNode.oversample = '4x';

    this.airNode = this.audioContext.createBiquadFilter();
    this.airNode.type = 'highshelf';
    this.airNode.frequency.value = 12000; 
    this.airNode.gain.value = settings.air;

    this.bodyNode = this.audioContext.createBiquadFilter();
    this.bodyNode.type = 'peaking';
    this.bodyNode.frequency.value = 300; // Lower mids warmth
    this.bodyNode.Q.value = 0.7; 
    this.bodyNode.gain.value = settings.body;

    this.dynamicBassNode = this.audioContext.createBiquadFilter();
    this.dynamicBassNode.type = 'peaking';
    this.dynamicBassNode.frequency.value = 65; // Punch freq
    this.dynamicBassNode.Q.value = 1.2;
    this.dynamicBassNode.gain.value = settings.dynamicBass;

    // Limiter is just a compressor with infinite ratio and fast attack
    this.limiterNode = this.audioContext.createDynamicsCompressor();
    this.limiterNode.threshold.value = settings.ceiling;
    this.limiterNode.ratio.value = 20; 
    this.limiterNode.knee.value = 0; 
    this.limiterNode.attack.value = 0.001; 
    this.limiterNode.release.value = 0.1; 
    
    this.msSideGainNode = this.audioContext.createGain();
    this.msSideGainNode.gain.value = 1.0 + settings.stereoWidth;

    this.stereoBassNode = this.audioContext.createBiquadFilter();
    this.stereoBassNode.type = 'lowshelf';
    this.stereoBassNode.frequency.value = 120; 
    this.stereoBassNode.gain.value = settings.stereoBass;

    this.reverbNode = this.audioContext.createConvolver();
    this.reverbNode.buffer = this.createImpulseResponse(this.audioContext, 3, settings.reverb.decay, false); 
    
    this.reverbToneNode = this.audioContext.createBiquadFilter();
    this.reverbToneNode.type = 'lowpass';
    this.reverbToneNode.frequency.value = 5000; // Darker reverb for better mix

    this.wetGainNode = this.audioContext.createGain();
    this.dryGainNode = this.audioContext.createGain();

    const sortedEq = [...settings.eq].sort((a, b) => a.frequency - b.frequency);
    this.eqNodes = sortedEq.map((band, index) => {
      const node = this.audioContext!.createBiquadFilter();
      node.type = index === 0 ? 'lowshelf' : index === sortedEq.length - 1 ? 'highshelf' : 'peaking';
      node.frequency.value = band.frequency;
      node.gain.value = band.gain;
      node.Q.value = 1.0; 
      return node;
    });

    this.updateSettings(settings);
  }

  public updateSettings(settings: MasteringSettings) {
    if (!this.audioContext) return;
    const now = this.audioContext.currentTime;

    if (this.gainNode) {
        this.gainNode.gain.cancelScheduledValues(now);
        this.gainNode.gain.setTargetAtTime(1.0 + settings.masterGain, now, 0.05);
    }

    if (this.compressorNode) {
      this.compressorNode.threshold.cancelScheduledValues(now);
      this.compressorNode.threshold.setTargetAtTime(settings.compressor.threshold, now, 0.05);
      
      this.compressorNode.ratio.cancelScheduledValues(now);
      this.compressorNode.ratio.setTargetAtTime(Math.max(1, settings.compressor.ratio), now, 0.05);
      
      this.compressorNode.attack.cancelScheduledValues(now);
      this.compressorNode.attack.setTargetAtTime(settings.compressor.attack, now, 0.05);
      
      this.compressorNode.release.cancelScheduledValues(now);
      this.compressorNode.release.setTargetAtTime(settings.compressor.release, now, 0.05);
    }

    const sortedEqSettings = [...settings.eq].sort((a,b) => a.frequency - b.frequency);
    this.eqNodes.forEach((node, index) => {
      if (sortedEqSettings[index]) {
        node.gain.cancelScheduledValues(now);
        node.gain.setTargetAtTime(sortedEqSettings[index].gain, now, 0.05);
      }
    });

    if (this.saturationNode) this.saturationNode.curve = this.makeDistortionCurve(settings.saturation);
    if (this.softClipNode) this.softClipNode.curve = this.makeSoftClipCurve(settings.softClip);
    
    if (this.airNode) {
        this.airNode.gain.cancelScheduledValues(now);
        this.airNode.gain.setTargetAtTime(settings.air, now, 0.05);
    }
    if (this.bodyNode) {
        this.bodyNode.gain.cancelScheduledValues(now);
        this.bodyNode.gain.setTargetAtTime(settings.body, now, 0.05);
    }
    if (this.dynamicBassNode) {
        this.dynamicBassNode.gain.cancelScheduledValues(now);
        this.dynamicBassNode.gain.setTargetAtTime(settings.dynamicBass, now, 0.05);
    }
    if (this.limiterNode) {
        this.limiterNode.threshold.cancelScheduledValues(now);
        this.limiterNode.threshold.setTargetAtTime(settings.ceiling, now, 0.05);
    }
    if (this.msSideGainNode) {
        this.msSideGainNode.gain.cancelScheduledValues(now);
        this.msSideGainNode.gain.setTargetAtTime(1.0 + settings.stereoWidth, now, 0.05);
    }
    if (this.stereoBassNode) {
        this.stereoBassNode.gain.cancelScheduledValues(now);
        this.stereoBassNode.gain.setTargetAtTime(settings.stereoBass, now, 0.05);
    }

    if (this.wetGainNode && this.dryGainNode) {
      this.wetGainNode.gain.cancelScheduledValues(now);
      this.wetGainNode.gain.setTargetAtTime(settings.reverb.mix, now, 0.05);
      
      this.dryGainNode.gain.cancelScheduledValues(now);
      this.dryGainNode.gain.setTargetAtTime(1 - settings.reverb.mix, now, 0.05);
    }
  }

  public play(offset: number, settings: MasteringSettings) {
    if (!this.audioContext || !this.audioBuffer) return;
    if (this.audioContext.state === 'suspended') this.audioContext.resume();

    this.setupGraph(settings);

    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;

    /* 
      NEW LOGICAL SIGNAL CHAIN:
      Source -> EQ (Fix) -> Dynamic Bass -> Body -> Saturation (Color) -> Compressor (Glue) -> 
      Reverb Split -> Air (Polish) -> M/S Split (Width) -> Soft Clip -> Limiter -> Out
    */

    let head: AudioNode = this.sourceNode;
    
    // 1. Corrective EQ first
    this.eqNodes.forEach(node => { head.connect(node); head = node; });
    
    // 2. Tone Shaping (Pre-Compression)
    head.connect(this.dynamicBassNode!); head = this.dynamicBassNode!;
    head.connect(this.bodyNode!); head = this.bodyNode!;
    
    // 3. Color (Saturation)
    head.connect(this.saturationNode!); head = this.saturationNode!;
    
    // 4. Dynamics (Compression)
    head.connect(this.compressorNode!); head = this.compressorNode!;

    // 5. Spatial (Reverb Send)
    head.connect(this.dryGainNode!);
    head.connect(this.reverbToneNode!);
    this.reverbToneNode!.connect(this.reverbNode!);
    this.reverbNode!.connect(this.wetGainNode!);
    
    // 6. Recombine & Polish (Air)
    this.dryGainNode!.connect(this.airNode!);
    this.wetGainNode!.connect(this.airNode!);
    
    // 7. M/S Processing (Stereo Width & Stereo Bass)
    const splitter = this.audioContext.createChannelSplitter(2);
    const merger = this.audioContext.createChannelMerger(2);
    const sumL = this.audioContext.createGain(); sumL.gain.value = 0.5;
    const sumR = this.audioContext.createGain(); sumR.gain.value = 0.5;
    const diffL = this.audioContext.createGain(); diffL.gain.value = 0.5;
    const diffR = this.audioContext.createGain(); diffR.gain.value = -0.5;
    
    this.airNode!.connect(splitter);
    
    // Create Sum (Mid) and Diff (Side)
    splitter.connect(sumL, 0); splitter.connect(sumR, 1);
    splitter.connect(diffL, 0); splitter.connect(diffR, 1);
    
    const midChannel = this.audioContext.createGain();
    sumL.connect(midChannel); sumR.connect(midChannel);

    const sideChannel = this.audioContext.createGain();
    diffL.connect(sideChannel); diffR.connect(sideChannel);
    
    // Apply Stereo Bass Only to Side Channel (adds width to low end)
    sideChannel.connect(this.stereoBassNode!);
    this.stereoBassNode!.connect(this.msSideGainNode!);
    
    // Recombine M/S to L/R
    const outL_Mid = this.audioContext.createGain(); outL_Mid.gain.value = 1;
    const outL_Side = this.audioContext.createGain(); outL_Side.gain.value = 1;
    const outR_Mid = this.audioContext.createGain(); outR_Mid.gain.value = 1;
    const outR_Side = this.audioContext.createGain(); outR_Side.gain.value = -1;

    midChannel.connect(outL_Mid); this.msSideGainNode!.connect(outL_Side);
    midChannel.connect(outR_Mid); this.msSideGainNode!.connect(outR_Side);
    
    outL_Mid.connect(merger, 0, 0); outL_Side.connect(merger, 0, 0);
    outR_Mid.connect(merger, 0, 1); outR_Side.connect(merger, 0, 1);

    // 8. Final Gain & Limiting
    merger.connect(this.gainNode!);
    this.gainNode!.connect(this.softClipNode!);
    this.softClipNode!.connect(this.limiterNode!);
    this.limiterNode!.connect(this.analyzerNode!);
    this.analyzerNode!.connect(this.audioContext.destination);

    this.startTime = this.audioContext.currentTime - offset;
    this.pausedAt = offset;
    this.sourceNode.start(0, offset);
    this.isPlaying = true;
  }

  public pause() {
    if (this.sourceNode && this.isPlaying) {
      try { this.sourceNode.stop(); } catch(e) {}
      if(this.audioContext) this.pausedAt = this.audioContext.currentTime - this.startTime;
      this.isPlaying = false;
    }
  }

  public seek(time: number, settings: MasteringSettings) {
    if (this.isPlaying) {
      this.pause();
      this.play(time, settings);
    } else {
      this.pausedAt = time;
    }
  }

  public getAnalyserData(array: Uint8Array) {
    if (this.analyzerNode) this.analyzerNode.getByteFrequencyData(array);
  }

  public getCurrentTime(): number {
    if (!this.audioContext || !this.isPlaying) return this.pausedAt;
    return this.audioContext.currentTime - this.startTime;
  }

  public getDuration(): number {
    return this.audioBuffer ? this.audioBuffer.duration : 0;
  }

  public async renderOffline(settings: MasteringSettings): Promise<AudioBuffer> {
      if (!this.audioBuffer) throw new Error("No Audio");
      const offlineCtx = new OfflineAudioContext(2, this.audioBuffer.length, this.audioBuffer.sampleRate);
      
      const source = offlineCtx.createBufferSource();
      source.buffer = this.audioBuffer;
      
      // --- OFFLINE GRAPH MIRRORS PLAY GRAPH ---
      
      const sortedEq = [...settings.eq].sort((a, b) => a.frequency - b.frequency);
      const eqNodes = sortedEq.map((band, index) => {
          const node = offlineCtx.createBiquadFilter();
          node.type = index === 0 ? 'lowshelf' : index === sortedEq.length - 1 ? 'highshelf' : 'peaking';
          node.frequency.value = band.frequency;
          node.gain.value = band.gain;
          node.Q.value = 1.0;
          return node;
      });
      
      const bodyNode = offlineCtx.createBiquadFilter();
      bodyNode.type = 'peaking';
      bodyNode.frequency.value = 300;
      bodyNode.Q.value = 0.7;
      bodyNode.gain.value = settings.body;

      const dynamicBassNode = offlineCtx.createBiquadFilter();
      dynamicBassNode.type = 'peaking';
      dynamicBassNode.frequency.value = 65;
      dynamicBassNode.Q.value = 1.2;
      dynamicBassNode.gain.value = settings.dynamicBass;

      const compressor = offlineCtx.createDynamicsCompressor();
      compressor.threshold.value = settings.compressor.threshold;
      compressor.ratio.value = Math.max(1, settings.compressor.ratio);
      compressor.attack.value = settings.compressor.attack;
      compressor.release.value = settings.compressor.release;

      const saturation = offlineCtx.createWaveShaper();
      saturation.curve = this.makeDistortionCurve(settings.saturation);
      saturation.oversample = 'none'; 

      const airNode = offlineCtx.createBiquadFilter();
      airNode.type = 'highshelf';
      airNode.frequency.value = 12000;
      airNode.gain.value = settings.air;

      const masterGain = offlineCtx.createGain();
      masterGain.gain.value = 1.0 + settings.masterGain;

      const softClip = offlineCtx.createWaveShaper();
      softClip.curve = this.makeSoftClipCurve(settings.softClip);
      softClip.oversample = 'none';

      const limiter = offlineCtx.createDynamicsCompressor();
      limiter.threshold.value = settings.ceiling;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.001;
      limiter.release.value = 0.1;

      const splitter = offlineCtx.createChannelSplitter(2);
      const merger = offlineCtx.createChannelMerger(2);
      const sumL = offlineCtx.createGain(); sumL.gain.value = 0.5;
      const sumR = offlineCtx.createGain(); sumR.gain.value = 0.5;
      const diffL = offlineCtx.createGain(); diffL.gain.value = 0.5;
      const diffR = offlineCtx.createGain(); diffR.gain.value = -0.5;
      const midChannel = offlineCtx.createGain();
      const sideChannel = offlineCtx.createGain();
      const msSideGain = offlineCtx.createGain(); 
      msSideGain.gain.value = 1.0 + settings.stereoWidth;
      
      const stereoBassNode = offlineCtx.createBiquadFilter();
      stereoBassNode.type = 'lowshelf';
      stereoBassNode.frequency.value = 120;
      stereoBassNode.gain.value = settings.stereoBass;

      const outL_Mid = offlineCtx.createGain(); outL_Mid.gain.value = 1;
      const outL_Side = offlineCtx.createGain(); outL_Side.gain.value = 1;
      const outR_Mid = offlineCtx.createGain(); outR_Mid.gain.value = 1;
      const outR_Side = offlineCtx.createGain(); outR_Side.gain.value = -1;

      const reverb = offlineCtx.createConvolver();
      reverb.buffer = this.createImpulseResponse(offlineCtx, 3, settings.reverb.decay, false);
      const reverbTone = offlineCtx.createBiquadFilter();
      reverbTone.type = 'lowpass';
      reverbTone.frequency.value = 5000;
      const wetGain = offlineCtx.createGain();
      wetGain.gain.value = settings.reverb.mix;
      const dryGain = offlineCtx.createGain();
      dryGain.gain.value = 1 - settings.reverb.mix;

      // CHAIN
      let head: AudioNode = source;
      eqNodes.forEach(n => { head.connect(n); head = n; });
      
      head.connect(dynamicBassNode); head = dynamicBassNode;
      head.connect(bodyNode); head = bodyNode;
      head.connect(saturation); head = saturation;
      head.connect(compressor); head = compressor;

      head.connect(dryGain);
      head.connect(reverbTone);
      reverbTone.connect(reverb);
      reverb.connect(wetGain);

      dryGain.connect(airNode);
      wetGain.connect(airNode);

      airNode.connect(splitter);
      splitter.connect(sumL, 0); splitter.connect(sumR, 1);
      splitter.connect(diffL, 0); splitter.connect(diffR, 1);
      sumL.connect(midChannel); sumR.connect(midChannel);
      diffL.connect(sideChannel); diffR.connect(sideChannel);
      
      sideChannel.connect(stereoBassNode);
      stereoBassNode.connect(msSideGain);

      midChannel.connect(outL_Mid); msSideGain.connect(outL_Side);
      midChannel.connect(outR_Mid); msSideGain.connect(outR_Side);
      outL_Mid.connect(merger, 0, 0); outL_Side.connect(merger, 0, 0);
      outR_Mid.connect(merger, 0, 1); outR_Side.connect(merger, 0, 1);

      merger.connect(masterGain);
      masterGain.connect(softClip);
      softClip.connect(limiter);
      limiter.connect(offlineCtx.destination);

      source.start(0);
      return await offlineCtx.startRendering();
  }
}

export const audioEngine = new AudioEngine();

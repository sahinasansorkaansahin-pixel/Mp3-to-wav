
import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, Upload, Download, RefreshCw, Sparkles, Volume2, Music, FileAudio, Activity, Mic2, Disc, ListMusic, Sliders, Zap, Waves, Guitar } from 'lucide-react';
import { AudioState, MasteringSettings, ExportFormat, PresetName } from './types';
import { DEFAULT_SETTINGS, PRESETS } from './constants';
import { audioEngine } from './services/AudioEngine';
import { Visualizer } from './components/Visualizer';
import { ControlKnob } from './components/ControlKnob';
import { EQRack } from './components/EQRack';

const App: React.FC = () => {
  const [audioState, setAudioState] = useState<AudioState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    fileName: 'untitled',
    isLoaded: false,
  });

  const [settings, setSettings] = useState<MasteringSettings>(DEFAULT_SETTINGS);
  const [activePreset, setActivePreset] = useState<PresetName>('Manual');
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>(ExportFormat.WAV_16);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  useEffect(() => {
    let raf: number;
    const updateTime = () => {
      if (audioState.isPlaying) {
        setAudioState(prev => ({ ...prev, currentTime: audioEngine.getCurrentTime() }));
        raf = requestAnimationFrame(updateTime);
      }
    };
    if (audioState.isPlaying) updateTime();
    return () => cancelAnimationFrame(raf);
  }, [audioState.isPlaying]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'audio/mpeg' && !file.name.toLowerCase().endsWith('.mp3')) {
        setUploadError("Only MP3 files are supported.");
        setTimeout(() => setUploadError(null), 3000);
        return;
    }

    audioEngine.pause();
    
    const buffer = await audioEngine.loadFile(file);
    
    setAudioState({
      ...audioState,
      isLoaded: true,
      duration: buffer.duration,
      fileName: file.name.replace(/\.[^/.]+$/, ""),
      isPlaying: false,
      currentTime: 0
    });

    // Apply current settings (or defaults) to new file
    audioEngine.setupGraph(settings);
  };

  const handleReset = () => {
      applyPreset('Manual');
  };

  const togglePlay = async () => {
    if (!audioState.isLoaded) return;
    if (audioState.isPlaying) {
      audioEngine.pause();
      setAudioState(prev => ({ ...prev, isPlaying: false }));
    } else {
      await audioEngine.resumeContext(); 
      audioEngine.play(audioState.currentTime, settings);
      setAudioState(prev => ({ ...prev, isPlaying: true }));
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setAudioState(prev => ({ ...prev, currentTime: time }));
    audioEngine.seek(time, settings);
  };

  const updateSetting = useCallback(<K extends keyof MasteringSettings>(key: K, value: MasteringSettings[K]) => {
    setSettings(prev => {
      const newSettings = { ...prev, [key]: value };
      audioEngine.updateSettings(newSettings);
      return newSettings;
    });
    // If user tweaks something, technically they are in "Manual" mode or modified preset
    if (activePreset !== 'Manual') {
        // Optional: Switch highlight to Manual or Keep preset highlighted to show base
        // setActivePreset('Manual'); 
    }
  }, [activePreset]);

  const handleEQChange = (index: number, gain: number) => {
    setSettings(prev => {
        const newEq = prev.eq.map((band, i) => 
            i === index ? { ...band, gain } : band
        );
        const newSettings = { ...prev, eq: newEq };
        audioEngine.updateSettings(newSettings);
        return newSettings;
    });
  };

  const applyPreset = (name: PresetName) => {
      const preset = PRESETS[name];
      // Deep copy to ensure we don't mutate the constant
      const newSettings = JSON.parse(JSON.stringify(preset.settings));
      setSettings(newSettings);
      audioEngine.updateSettings(newSettings);
      setActivePreset(name);
  };

  const handleExportWAV = async () => {
    if (!audioState.isLoaded) return;
    setIsExporting(true);
    
    try {
        const renderedBuffer = await audioEngine.renderOffline(settings);
        const wavBlob = encodeWAV(renderedBuffer, exportFormat);

        let suffix = "_master_16bit";
        if (exportFormat === ExportFormat.WAV_24) suffix = "_master_24bit";
        if (exportFormat === ExportFormat.WAV_32) suffix = "_master_32bit_float";
        
        downloadBlob(wavBlob, `${audioState.fileName}${suffix}.wav`);
    } catch (err) {
        console.error("Export failed", err);
    } finally {
        setIsExporting(false);
    }
  };

  const downloadBlob = (blob: Blob, name: string) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
  };

  const encodeWAV = (buffer: AudioBuffer, format: ExportFormat) => {
      const numChannels = buffer.numberOfChannels;
      const sampleRate = buffer.sampleRate;
      const length = buffer.length;
      
      let bitDepth = 16;
      let formatTag = 1; 
      if (format === ExportFormat.WAV_24) bitDepth = 24;
      if (format === ExportFormat.WAV_32) { bitDepth = 32; formatTag = 3; } 
      
      const bytesPerSample = bitDepth / 8;
      const blockAlign = numChannels * bytesPerSample;
      const byteRate = sampleRate * blockAlign;
      const dataSize = length * blockAlign;
      const headerSize = 44;
      const totalSize = headerSize + dataSize;

      const arrayBuffer = new ArrayBuffer(totalSize);
      const view = new DataView(arrayBuffer);

      const writeString = (offset: number, string: string) => {
          for (let i = 0; i < string.length; i++) {
              view.setUint8(offset + i, string.charCodeAt(i));
          }
      };

      writeString(0, 'RIFF');
      view.setUint32(4, 36 + dataSize, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true); 
      view.setUint16(20, formatTag, true); 
      view.setUint16(22, numChannels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, byteRate, true);
      view.setUint16(32, blockAlign, true);
      view.setUint16(34, bitDepth, true);
      writeString(36, 'data');
      view.setUint32(40, dataSize, true);

      let offset = 44;
      const channels = [];
      for (let i = 0; i < numChannels; i++) channels.push(buffer.getChannelData(i));

      if (format === ExportFormat.WAV_32) {
          for (let i = 0; i < length; i++) {
              for (let ch = 0; ch < numChannels; ch++) {
                  view.setFloat32(offset, channels[ch][i], true);
                  offset += 4;
              }
          }
      } else if (format === ExportFormat.WAV_24) {
          for (let i = 0; i < length; i++) {
              for (let ch = 0; ch < numChannels; ch++) {
                  let s = Math.max(-1, Math.min(1, channels[ch][i]));
                  s = s < 0 ? s * 0x800000 : s * 0x7FFFFF;
                  const val = Math.round(s);
                  view.setUint8(offset, val & 0xFF);
                  view.setUint8(offset + 1, (val >> 8) & 0xFF);
                  view.setUint8(offset + 2, (val >> 16) & 0xFF);
                  offset += 3;
              }
          }
      } else {
          for (let i = 0; i < length; i++) {
              for (let ch = 0; ch < numChannels; ch++) {
                  let s = Math.max(-1, Math.min(1, channels[ch][i]));
                  s = s < 0 ? s * 0x8000 : s * 0x7FFF;
                  view.setInt16(offset, s, true);
                  offset += 2;
              }
          }
      }
      return new Blob([view], { type: 'audio/wav' });
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const RackScrew = () => (
    <div className="w-3 h-3 rounded-full bg-neutral-700 border border-neutral-600 flex items-center justify-center shadow-inner">
        <div className="w-full h-0.5 bg-neutral-800 transform rotate-45"></div>
        <div className="w-full h-0.5 bg-neutral-800 transform -rotate-45 absolute"></div>
    </div>
  );

  const getPresetIcon = (name: PresetName) => {
      switch(name) {
          case 'Pop': return <Sparkles size={14} />;
          case 'Rap': return <Zap size={14} />;
          case 'Rock': return <Guitar size={14} />;
          case 'Anatolian Rock': return <Guitar size={14} />;
          case 'Acoustic': return <Music size={14} />;
          case 'Vocal': return <Mic2 size={14} />;
          case 'Arabesk': return <Waves size={14} />;
          case 'Slow': return <Disc size={14} />;
          case 'Manual': return <Sliders size={14} />;
          default: return <ListMusic size={14} />;
      }
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-oled text-gray-300 font-sans selection:bg-cyan-500/30 overflow-hidden">
      <header className="flex-none border-b border-glassBorder bg-glass backdrop-blur-sm p-4 flex justify-between items-center z-50 shadow-lg shadow-black/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-cyan-500 rounded flex items-center justify-center text-black font-bold shadow-[0_0_15px_rgba(6,182,212,0.6)]">
            <Music size={20} />
          </div>
          <h1 className="font-bold tracking-wider text-lg text-white">MP3 to WAV <span className="text-cyan-400 font-light">Studio</span></h1>
        </div>
        <div className="flex items-center gap-4">
          {uploadError && (
              <span className="text-red-400 text-xs font-bold animate-pulse">{uploadError}</span>
          )}
          <label className="flex items-center gap-2 cursor-pointer bg-cyan-900/20 hover:bg-cyan-900/40 px-3 py-1.5 rounded border border-cyan-900/50 transition-all group">
            <Upload size={16} className="group-hover:text-cyan-400" />
            <span className="text-sm font-medium hidden sm:inline group-hover:text-white">Load MP3</span>
            <input type="file" accept=".mp3,audio/mpeg" onChange={handleFileUpload} className="hidden" />
          </label>
          <button 
            onClick={handleReset}
            className="flex items-center gap-2 text-sm hover:text-red-400 transition-colors"
          >
            <RefreshCw size={16} /> <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
        <main className="p-4 md:p-8 max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 pb-24">
            
            <div className="lg:col-span-8 flex flex-col gap-6">
              {/* VISUALIZER SECTION */}
              <div className="bg-neutral-900/50 rounded-xl border border-glassBorder overflow-hidden relative shadow-2xl shadow-black">
                  <div className="absolute top-4 left-4 z-10 flex flex-col">
                      <span className="text-xs text-gray-500 font-mono uppercase">Source File</span>
                      <span className="text-white font-medium truncate max-w-md flex items-center gap-2">
                          {audioState.isLoaded ? (
                              <><FileAudio size={14} className="text-cyan-500"/> {audioState.fileName}.mp3</>
                          ) : 'No MP3 Loaded'}
                      </span>
                  </div>
                  <div className="pt-16 pb-0">
                      <Visualizer isPlaying={audioState.isPlaying} />
                  </div>
                  <div className="bg-glass p-4 border-t border-glassBorder">
                      <div className="flex items-center gap-4 mb-2">
                          <span className="text-xs font-mono w-10 text-right">{formatTime(audioState.currentTime)}</span>
                          <input 
                              type="range" 
                              min="0" 
                              max={audioState.duration || 100} 
                              value={audioState.currentTime}
                              onChange={handleSeek}
                              disabled={!audioState.isLoaded}
                              className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:rounded-full"
                          />
                          <span className="text-xs font-mono w-10">{formatTime(audioState.duration)}</span>
                      </div>
                      <div className="flex justify-center items-center gap-6">
                          <button 
                              onClick={togglePlay} 
                              disabled={!audioState.isLoaded}
                              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                                  !audioState.isLoaded ? 'bg-gray-800 text-gray-600' :
                                  'bg-cyan-500 text-black hover:bg-cyan-400 hover:scale-105 shadow-[0_0_20px_rgba(6,182,212,0.4)]'
                              }`}
                          >
                              {audioState.isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" className="ml-1" />}
                          </button>
                      </div>
                  </div>
              </div>

              <EQRack bands={settings.eq} onChange={handleEQChange} />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* RACK UNIT 1: DYNAMICS */}
                <div className="bg-[#151515] border-2 border-neutral-800 rounded-sm p-1 shadow-xl relative group">
                    <div className="absolute top-2 left-2"><RackScrew /></div>
                    <div className="absolute top-2 right-2"><RackScrew /></div>
                    <div className="absolute bottom-2 left-2"><RackScrew /></div>
                    <div className="absolute bottom-2 right-2"><RackScrew /></div>
                    
                    <div className="h-full bg-[#1a1a1a] border border-neutral-800/50 p-4 flex flex-col items-center rounded-sm">
                        <div className="w-full flex justify-between items-center border-b border-neutral-800 pb-2 mb-4">
                             <h2 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1">
                                <Activity size={12} /> VCA Dynamics
                             </h2>
                             <div className="w-2 h-2 rounded-full bg-green-500/50 shadow-[0_0_5px_rgba(34,197,94,0.5)]"></div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-x-4 gap-y-6 w-full px-2">
                            <ControlKnob 
                                label="Threshold" value={settings.compressor.threshold} min={-60} max={0} step={1} unit="dB"
                                onChange={(v) => updateSetting('compressor', { ...settings.compressor, threshold: v })}
                            />
                            <ControlKnob 
                                label="Ratio" value={settings.compressor.ratio} min={0} max={20} step={0.1} unit=":1"
                                onChange={(v) => updateSetting('compressor', { ...settings.compressor, ratio: v })}
                            />
                            <ControlKnob 
                                label="Attack" value={settings.compressor.attack} min={0} max={1} step={0.001} unit="s"
                                onChange={(v) => updateSetting('compressor', { ...settings.compressor, attack: v })}
                                color="text-yellow-500"
                            />
                            <ControlKnob 
                                label="Release" value={settings.compressor.release} min={0} max={1} step={0.01} unit="s"
                                onChange={(v) => updateSetting('compressor', { ...settings.compressor, release: v })}
                                color="text-yellow-500"
                            />
                        </div>
                    </div>
                </div>

                {/* RACK UNIT 2: ENHANCERS */}
                <div className="bg-[#151515] border-2 border-neutral-800 rounded-sm p-1 shadow-xl relative">
                    <div className="absolute top-2 left-2"><RackScrew /></div>
                    <div className="absolute top-2 right-2"><RackScrew /></div>
                    <div className="absolute bottom-2 left-2"><RackScrew /></div>
                    <div className="absolute bottom-2 right-2"><RackScrew /></div>

                    <div className="h-full bg-[#1e1c1c] border border-neutral-800/50 p-4 flex flex-col items-center rounded-sm">
                         <div className="w-full flex justify-between items-center border-b border-neutral-800 pb-2 mb-4">
                             <h2 className="text-[10px] font-bold text-orange-300/80 uppercase tracking-widest flex items-center gap-1">
                                <Sparkles size={12} /> Harmonic Exciter
                             </h2>
                             <div className="w-2 h-2 rounded-full bg-orange-500/50 shadow-[0_0_5px_rgba(249,115,22,0.5)]"></div>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-6 w-full px-2">
                             <ControlKnob 
                                label="Tube Drive" value={settings.saturation} min={0} max={0.1} step={0.001} 
                                onChange={(v) => updateSetting('saturation', v)}
                                color="text-orange-500"
                            />
                            <ControlKnob 
                                label="Warmth" value={settings.body} min={0} max={6} step={0.1} unit="dB"
                                onChange={(v) => updateSetting('body', v)}
                                color="text-red-400"
                            />
                            <ControlKnob 
                                label="Brilliance" value={settings.air} min={0} max={12} step={0.5} unit="dB"
                                onChange={(v) => updateSetting('air', v)}
                                color="text-blue-300"
                            />
                            <ControlKnob 
                                label="M/S Width" value={settings.stereoWidth} min={0} max={1} step={0.05} unit="x"
                                onChange={(v) => updateSetting('stereoWidth', v)}
                                color="text-purple-400"
                            />
                        </div>
                    </div>
                </div>

                {/* RACK UNIT 3: OUTPUT STAGE */}
                <div className="bg-[#151515] border-2 border-neutral-800 rounded-sm p-1 shadow-xl relative">
                    <div className="absolute top-2 left-2"><RackScrew /></div>
                    <div className="absolute top-2 right-2"><RackScrew /></div>
                    <div className="absolute bottom-2 left-2"><RackScrew /></div>
                    <div className="absolute bottom-2 right-2"><RackScrew /></div>
                    
                    <div className="h-full bg-[#18181b] border border-neutral-800/50 p-4 flex flex-col items-center rounded-sm">
                        <div className="w-full flex justify-between items-center border-b border-neutral-800 pb-2 mb-4">
                             <h2 className="text-[10px] font-bold text-red-400/80 uppercase tracking-widest flex items-center gap-1">
                                <Volume2 size={12} /> Master Output
                             </h2>
                             <div className="w-2 h-2 rounded-full bg-red-500/50 shadow-[0_0_5px_rgba(239,68,68,0.5)]"></div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-x-4 gap-y-6 w-full px-2">
                             <ControlKnob 
                                label="Stereo Bass" value={settings.stereoBass} min={0} max={12} step={0.5} unit="dB"
                                onChange={(v) => updateSetting('stereoBass', v)}
                                color="text-indigo-400"
                            />
                             <ControlKnob 
                                label="Dynamic Bass" value={settings.dynamicBass} min={0} max={12} step={0.5} unit="dB"
                                onChange={(v) => updateSetting('dynamicBass', v)}
                                color="text-rose-500"
                            />
                             <ControlKnob 
                                label="Out Gain" value={settings.masterGain} min={0} max={1} step={0.05} 
                                onChange={(v) => updateSetting('masterGain', v)}
                                color="text-white"
                                unit="x"
                            />
                            <ControlKnob 
                                label="Ceiling" value={settings.ceiling} min={-6} max={0} step={0.1} unit="dB"
                                onChange={(v) => updateSetting('ceiling', v)}
                                color="text-red-500"
                            />
                        </div>
                    </div>
                </div>

              </div>
            </div>

            <div className="lg:col-span-4 flex flex-col gap-6">
                
                {/* PRESET LIBRARY */}
                <div className="bg-gradient-to-b from-neutral-900 to-black border border-glassBorder rounded-xl p-1 relative overflow-hidden flex flex-col h-[600px] shadow-2xl">
                    <div className="p-5 pb-4 bg-neutral-900/90 backdrop-blur-sm z-10 border-b border-white/5">
                        <div className="flex justify-between items-center">
                           <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                                <ListMusic size={16} /> Preset Library
                           </h2>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1">Select a professionally engineered profile.</p>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-2 gap-2 flex flex-col">
                        {Object.values(PRESETS).map((preset) => (
                            <button
                                key={preset.name}
                                onClick={() => applyPreset(preset.name)}
                                className={`flex flex-col p-3 rounded border text-left transition-all duration-200 relative group ${
                                    activePreset === preset.name 
                                    ? 'bg-cyan-900/20 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.1)]' 
                                    : 'bg-neutral-900/50 border-white/5 hover:bg-neutral-800 hover:border-white/10'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className={`text-xs font-bold uppercase flex items-center gap-2 ${
                                        activePreset === preset.name ? 'text-cyan-400' : 'text-gray-300'
                                    }`}>
                                        {getPresetIcon(preset.name)}
                                        {preset.name}
                                    </span>
                                    {activePreset === preset.name && (
                                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_5px_#06b6d4]"></div>
                                    )}
                                </div>
                                <p className="text-[10px] text-gray-500 group-hover:text-gray-400 transition-colors">
                                    {preset.description}
                                </p>
                            </button>
                        ))}
                    </div>

                    {/* INFO FOOTER */}
                    <div className="p-3 bg-black border-t border-white/10 text-[9px] text-gray-600 font-mono text-center">
                        PROFESSIONAL MASTERING PRESETS
                    </div>
                </div>

                <div className="bg-neutral-900 border border-glassBorder rounded-xl p-4 shadow-lg">
                    <div className="flex flex-col gap-3">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Export Configuration</label>
                        
                        <div className="flex gap-2 mt-1">
                          {Object.values(ExportFormat).map(fmt => (
                            <button
                              key={fmt}
                              onClick={() => setExportFormat(fmt)}
                              className={`flex-1 py-2 text-[10px] font-bold uppercase border rounded transition-all ${
                                exportFormat === fmt 
                                  ? 'bg-cyan-500 text-black border-cyan-500 shadow-[0_0_10px_rgba(34,211,238,0.4)]' 
                                  : 'bg-black text-gray-500 border-gray-800 hover:border-gray-600 hover:text-gray-300'
                              }`}
                            >
                              {fmt}
                            </button>
                          ))}
                        </div>
                        
                        <button 
                            onClick={handleExportWAV}
                            disabled={!audioState.isLoaded || isExporting}
                            className="w-full bg-white hover:bg-gray-200 text-black py-3 rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 disabled:bg-gray-600 transition-all mt-2"
                        >
                            {isExporting ? <RefreshCw className="animate-spin" size={14} /> : <Download size={14} />}
                            {isExporting ? 'Rendering...' : `Export ${exportFormat}`}
                        </button>
                    </div>
                </div>
            </div>
        </main>
      </div>
    </div>
  );
};

export default App;
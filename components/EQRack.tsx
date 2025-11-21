import React from 'react';
import { EQBand } from '../types';

interface EQRackProps {
  bands: EQBand[];
  onChange: (index: number, gain: number) => void;
}

export const EQRack: React.FC<EQRackProps> = ({ bands, onChange }) => {
  const formatFreq = (f: number) => {
    if (f >= 1000) {
        return `${(f / 1000).toString().replace('.0', '')}k`;
    }
    return f.toString();
  };

  return (
    <div className="bg-glass border border-glassBorder rounded-lg p-4 backdrop-blur-md">
      <div className="flex justify-between items-center mb-4">
          <h3 className="text-xs font-bold text-gray-400 tracking-widest uppercase">Parametric EQ (32-Bit FP)</h3>
          <span className="text-[10px] text-cyan-500 font-mono border border-cyan-900/50 bg-cyan-950/30 px-2 py-0.5 rounded">
            {bands.length} BANDS
          </span>
      </div>
      
      <div className="flex justify-between items-end h-48 gap-1 md:gap-2 overflow-x-auto pb-2">
        {bands.map((band, index) => (
          <div key={band.frequency} className="flex flex-col items-center h-full min-w-[24px] w-full gap-2 group">
             {/* Slider Track */}
             <div className="relative flex-1 w-6 md:w-8 bg-black/50 rounded-full overflow-hidden border border-white/5 hover:border-white/10 transition-colors">
                {/* Center Line */}
                <div className="absolute top-1/2 w-full h-px bg-gray-700"></div>
                <div className="absolute top-1/4 w-full h-px bg-gray-800/50 border-t border-dashed border-gray-800"></div>
                <div className="absolute bottom-1/4 w-full h-px bg-gray-800/50 border-t border-dashed border-gray-800"></div>
                
                {/* Fill */}
                <div 
                    className={`absolute bottom-1/2 w-full transition-all duration-75 ${
                        band.frequency > 10000 ? 'bg-purple-500/60' : 'bg-cyan-500/50'
                    }`}
                    style={{ 
                        height: `${Math.abs(band.gain) / 24 * 100}%`,
                        bottom: band.gain > 0 ? '50%' : `calc(50% - ${Math.abs(band.gain) / 24 * 100}%)`
                    }}
                ></div>

                {/* Thumb Input */}
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="0.1"
                  value={band.gain}
                  onChange={(e) => onChange(index, parseFloat(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-ns-resize z-10"
                />
                
                {/* Visual Thumb */}
                <div 
                    className="absolute w-full h-0.5 bg-white pointer-events-none transition-all duration-75 shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                    style={{ 
                        bottom: `calc(50% + ${band.gain / 24 * 100}%)`
                    }}
                ></div>
             </div>
             
             {/* Labels */}
             <div className="flex flex-col items-center gap-0.5">
                 <span className={`text-[9px] font-mono font-medium ${band.frequency > 16000 ? 'text-purple-400' : 'text-gray-500'}`}>
                    {formatFreq(band.frequency)}
                 </span>
                 <span className="text-[8px] text-cyan-300 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-5 bg-black/80 px-1 rounded">
                    {band.gain > 0 ? '+' : ''}{band.gain.toFixed(1)}
                 </span>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
};
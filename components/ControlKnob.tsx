import React from 'react';

interface ControlKnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (val: number) => void;
  color?: string;
}

export const ControlKnob: React.FC<ControlKnobProps> = ({ 
  label, value, min, max, step, unit = '', onChange, color = 'text-cyan-400' 
}) => {
  
  // Calculate percentage (0 to 1)
  const percent = Math.min(1, Math.max(0, (value - min) / (max - min)));
  
  // SVG Configuration for 270-degree arc
  const size = 100;
  const center = size / 2;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75; // 270 degrees is 75% of circle
  const rotation = 135; // Start from bottom-left

  // Dynamic dash array for the filled part
  const currentLength = percent * arcLength;

  // Formatting logic: Hz values are integers, everything else is 0.00
  const displayValue = max > 50 
    ? Math.round(value).toString() 
    : value.toFixed(2);

  return (
    <div className="flex flex-col items-center gap-2 group shrink-0">
      <div className="relative w-16 h-16 flex items-center justify-center">
        
        <svg 
            viewBox={`0 0 ${size} ${size}`} 
            className="w-full h-full drop-shadow-lg"
        >
          {/* Background Track (Dark Gray) */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#333"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference}`}
            transform={`rotate(${rotation} ${center} ${center})`}
            className="opacity-50"
          />
          
          {/* Value Fill (Colored) */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${currentLength} ${circumference}`}
            transform={`rotate(${rotation} ${center} ${center})`}
            className={`${color} transition-all duration-100 ease-out`}
          />
        </svg>

        {/* Inner Value Display */}
        <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
           <span className="text-[11px] font-mono font-bold text-gray-200 tracking-tighter">
             {displayValue}
           </span>
           {unit && <span className="text-[8px] text-gray-500 -mt-0.5">{unit}</span>}
        </div>
        
        {/* Invisible Range Input for Interaction */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-ns-resize z-10"
          title={`${label}: ${value}${unit}`}
        />
      </div>
      
      <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500 group-hover:text-white transition-colors text-center">
        {label}
      </span>
    </div>
  );
};
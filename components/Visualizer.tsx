
import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../services/AudioEngine';

interface VisualizerProps {
  isPlaying: boolean;
}

export const Visualizer: React.FC<VisualizerProps> = ({ isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dataArray = new Uint8Array(1024); // Half of FFT size
    
    const draw = () => {
      // Stop drawing if not playing to save GPU/CPU resources
      if (!isPlaying) {
         if (animationRef.current) cancelAnimationFrame(animationRef.current);
         return; 
      }

      const width = canvas.width;
      const height = canvas.height;
      
      audioEngine.getAnalyserData(dataArray);

      ctx.clearRect(0, 0, width, height);
      
      // Draw Grid
      ctx.strokeStyle = '#1a1a1a';
      ctx.beginPath();
      for(let i=0; i<width; i+=20) { ctx.moveTo(i,0); ctx.lineTo(i,height); }
      ctx.stroke();

      // Draw Spectrum
      const barWidth = (width / dataArray.length) * 2.5;
      let x = 0;

      // Gradient
      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, '#050505');
      gradient.addColorStop(0.5, '#00e5ff');
      gradient.addColorStop(1, '#ffffff');

      ctx.fillStyle = gradient;

      for (let i = 0; i < dataArray.length; i++) {
        const value = dataArray[i];
        const percent = value / 256;
        const barHeight = percent * height;

        // Mirror effect for aesthetic
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);
        
        x += barWidth + 1;
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    if (isPlaying) {
        draw();
    } else {
        // Clear canvas on stop
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying]);

  return (
    <div className="w-full h-32 bg-black/40 border-y border-glassBorder relative overflow-hidden">
        <canvas 
            ref={canvasRef} 
            width={800} 
            height={128} 
            className="w-full h-full opacity-80"
        />
    </div>
  );
};

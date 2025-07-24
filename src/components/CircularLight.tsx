import { useEffect, useRef } from 'react';

interface CircularLightProps {
  size?: number;
}

export function CircularLight({ size = 350 }: CircularLightProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = size;
    canvas.height = size;

    let time = 0;
    let animationId: number;

    const centerX = size / 2;
    const centerY = size / 2;

    function drawElegantPortal() {
      // Clear canvas
      ctx.clearRect(0, 0, size, size);

      // Subtle pulsing waves
      for (let wave = 0; wave < 8; wave++) {
        const waveRadius = 30 + (wave * 15) + Math.sin(time * 0.02 + wave * 0.5) * 8;
        const waveOpacity = Math.max(0, 0.6 - wave * 0.08) * (0.8 + Math.sin(time * 0.03) * 0.2);
        
        // Soft gradient ring
        const gradient = ctx.createRadialGradient(
          centerX, centerY, waveRadius - 2,
          centerX, centerY, waveRadius + 2
        );
        gradient.addColorStop(0, 'rgba(100, 200, 255, 0)');
        gradient.addColorStop(0.5, `rgba(0, 150, 255, ${waveOpacity})`);
        gradient.addColorStop(1, 'rgba(100, 200, 255, 0)');
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(centerX, centerY, waveRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Flowing particles in elegant spiral
      const particleCount = 40;
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 4 + time * 0.01;
        const radius = 50 + Math.sin(angle * 0.5 + time * 0.02) * 30;
        
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        
        const particleOpacity = 0.7 + Math.sin(time * 0.03 + i * 0.1) * 0.3;
        const particleSize = 1.5 + Math.sin(time * 0.025 + i * 0.2) * 0.8;
        
        // Soft particle glow
        const particleGlow = ctx.createRadialGradient(x, y, 0, x, y, particleSize * 6);
        particleGlow.addColorStop(0, `rgba(200, 240, 255, ${particleOpacity})`);
        particleGlow.addColorStop(0.4, `rgba(100, 200, 255, ${particleOpacity * 0.6})`);
        particleGlow.addColorStop(1, 'rgba(50, 150, 255, 0)');
        
        ctx.fillStyle = particleGlow;
        ctx.beginPath();
        ctx.arc(x, y, particleSize * 6, 0, Math.PI * 2);
        ctx.fill();
        
        // Bright core
        ctx.fillStyle = `rgba(255, 255, 255, ${particleOpacity * 0.8})`;
        ctx.beginPath();
        ctx.arc(x, y, particleSize, 0, Math.PI * 2);
        ctx.fill();
      }

      // Central energy core
      const coreSize = 15 + Math.sin(time * 0.04) * 5;
      const coreGlow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreSize * 2);
      coreGlow.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      coreGlow.addColorStop(0.3, 'rgba(150, 220, 255, 0.7)');
      coreGlow.addColorStop(0.7, 'rgba(50, 150, 255, 0.3)');
      coreGlow.addColorStop(1, 'rgba(0, 100, 200, 0)');
      
      ctx.fillStyle = coreGlow;
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreSize * 2, 0, Math.PI * 2);
      ctx.fill();

      // Elegant energy tendrils
      for (let i = 0; i < 12; i++) {
        const tendrilAngle = (i / 12) * Math.PI * 2 + time * 0.008;
        const tendrilLength = 25 + Math.sin(time * 0.03 + i * 0.5) * 15;
        
        const startX = centerX + Math.cos(tendrilAngle) * 8;
        const startY = centerY + Math.sin(tendrilAngle) * 8;
        const endX = centerX + Math.cos(tendrilAngle) * tendrilLength;
        const endY = centerY + Math.sin(tendrilAngle) * tendrilLength;
        
        const tendrilGradient = ctx.createLinearGradient(startX, startY, endX, endY);
        tendrilGradient.addColorStop(0, 'rgba(180, 230, 255, 0.6)');
        tendrilGradient.addColorStop(0.7, 'rgba(100, 180, 255, 0.3)');
        tendrilGradient.addColorStop(1, 'rgba(50, 120, 200, 0)');
        
        ctx.strokeStyle = tendrilGradient;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }

      time += 1;
      animationId = requestAnimationFrame(drawElegantPortal);
    }

    drawElegantPortal();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [size]);

  return (
    <div className="absolute left-[40%] top-[60%] transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
      <canvas
        ref={canvasRef}
        className="block"
        style={{ 
          filter: 'drop-shadow(0 0 15px rgba(100, 200, 255, 0.5))',
          opacity: 0.8
        }}
      />
    </div>
  );
}
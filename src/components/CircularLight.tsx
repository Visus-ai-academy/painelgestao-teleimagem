import { useEffect, useRef } from 'react';

interface CircularLightProps {
  size?: number;
}

export function CircularLight({ size = 300 }: CircularLightProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = size;
    canvas.height = size;

    let rotation = 0;
    let animationId: number;

    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size * 0.35;

    function draw() {
      // Clear canvas
      ctx.clearRect(0, 0, size, size);

      // Draw rotating light particles around the circle
      for (let i = 0; i < 60; i++) {
        const angle = (i / 60) * Math.PI * 2 + rotation;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        
        // Calculate opacity based on position (create flowing effect)
        const opacity = (Math.sin(angle - rotation * 2) + 1) * 0.3 + 0.1;
        
        // Light particle
        ctx.fillStyle = `rgba(0, 255, 255, ${opacity})`;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();

        // Glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'cyan';
        ctx.fillStyle = `rgba(0, 255, 255, ${opacity * 0.5})`;
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Draw light trails
      for (let i = 0; i < 3; i++) {
        const trailAngle = rotation + (i * Math.PI * 2) / 3;
        const trailX = centerX + Math.cos(trailAngle) * radius;
        const trailY = centerY + Math.sin(trailAngle) * radius;
        
        // Create gradient for trail
        const gradient = ctx.createRadialGradient(trailX, trailY, 0, trailX, trailY, 20);
        gradient.addColorStop(0, 'rgba(0, 255, 255, 0.6)');
        gradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(trailX, trailY, 20, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw central glow
      const centralGlow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 50);
      centralGlow.addColorStop(0, 'rgba(0, 255, 255, 0.3)');
      centralGlow.addColorStop(0.5, 'rgba(0, 200, 255, 0.2)');
      centralGlow.addColorStop(1, 'rgba(0, 150, 255, 0)');
      
      ctx.fillStyle = centralGlow;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 50, 0, Math.PI * 2);
      ctx.fill();

      rotation += 0.02;
      animationId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [size]);

  return (
    <div className="absolute left-[30%] top-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
      <canvas
        ref={canvasRef}
        className="block"
        style={{ 
          filter: 'blur(1px)',
          opacity: 0.7
        }}
      />
    </div>
  );
}
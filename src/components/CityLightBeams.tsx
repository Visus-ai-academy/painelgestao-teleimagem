import { useEffect, useRef } from 'react';

interface ConvergingLightBeamsProps {
  width?: number;
  height?: number;
  beamCount?: number;
  speed?: number;
}

export function CityLightBeams({ 
  width = 1920, 
  height = 1080, 
  beamCount = 40,
  speed = 2
}: ConvergingLightBeamsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;

    // Target point - representing TeleImagem headquarters (center-upper area)
    const targetX = width * 0.5;
    const targetY = height * 0.3;

    // Light beam structure for curved convergence
    interface ConvergingBeam {
      startX: number;
      startY: number;
      currentX: number;
      currentY: number;
      progress: number;
      speed: number;
      opacity: number;
      color: string;
      controlPointX: number;
      controlPointY: number;
    }

    const beams: ConvergingBeam[] = [];

    // Initialize converging light beams from various points
    for (let i = 0; i < beamCount; i++) {
      const angle = (i / beamCount) * Math.PI * 2;
      const radius = Math.min(width, height) * 0.8;
      const startX = width / 2 + Math.cos(angle) * radius;
      const startY = height + Math.sin(angle) * radius * 0.3;
      
      beams.push({
        startX,
        startY,
        currentX: startX,
        currentY: startY,
        progress: Math.random(),
        speed: (Math.random() * speed + 0.5) * 0.01,
        opacity: Math.random() * 0.6 + 0.2,
        color: `hsla(${180 + Math.random() * 60}, 70%, 60%, `,
        controlPointX: startX + (Math.random() - 0.5) * 200,
        controlPointY: startY - Math.random() * 300
      });
    }

    let animationId: number;

    function drawQuadraticCurve(
      ctx: CanvasRenderingContext2D,
      startX: number,
      startY: number,
      controlX: number,
      controlY: number,
      endX: number,
      endY: number,
      progress: number,
      opacity: number,
      color: string
    ) {
      if (progress <= 0) return;

      const segments = Math.min(50, Math.max(10, progress * 50));
      
      ctx.strokeStyle = `${color}${opacity})`;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      
      // Create gradient along the curve
      const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
      gradient.addColorStop(0, `${color}0)`);
      gradient.addColorStop(0.5, `${color}${opacity})`);
      gradient.addColorStop(1, `${color}${opacity * 1.5})`);
      
      ctx.strokeStyle = gradient;
      
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      
      for (let i = 1; i <= segments * progress; i++) {
        const t = i / segments;
        const x = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * controlX + t * t * endX;
        const y = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * controlY + t * t * endY;
        ctx.lineTo(x, y);
      }
      
      ctx.stroke();
      
      // Add glow effect at the end point
      if (progress > 0.8) {
        const currentT = progress;
        const currentX = (1 - currentT) * (1 - currentT) * startX + 2 * (1 - currentT) * currentT * controlX + currentT * currentT * endX;
        const currentY = (1 - currentT) * (1 - currentT) * startY + 2 * (1 - currentT) * currentT * controlY + currentT * currentT * endY;
        
        ctx.shadowBlur = 15;
        ctx.shadowColor = color.replace('hsla', 'hsl').replace(', ', '');
        ctx.fillStyle = `${color}${opacity * 0.8})`;
        ctx.beginPath();
        ctx.arc(currentX, currentY, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    function draw() {
      // Clear canvas with slight fade effect
      ctx.fillStyle = 'rgba(10, 20, 40, 0.05)';
      ctx.fillRect(0, 0, width, height);

      // Draw converging beams
      beams.forEach((beam) => {
        drawQuadraticCurve(
          ctx,
          beam.startX,
          beam.startY,
          beam.controlPointX,
          beam.controlPointY,
          targetX,
          targetY,
          beam.progress,
          beam.opacity,
          beam.color
        );

        // Update progress
        beam.progress += beam.speed;
        
        // Reset beam when it completes the curve
        if (beam.progress >= 1) {
          beam.progress = 0;
          beam.opacity = Math.random() * 0.6 + 0.2;
          beam.speed = (Math.random() * speed + 0.5) * 0.01;
          
          // Randomize start position
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.min(width, height) * (0.6 + Math.random() * 0.4);
          beam.startX = width / 2 + Math.cos(angle) * radius;
          beam.startY = height + Math.sin(angle) * radius * 0.3;
          beam.controlPointX = beam.startX + (Math.random() - 0.5) * 200;
          beam.controlPointY = beam.startY - Math.random() * 300;
        }
      });

      // Add central glow at target point (TeleImagem HQ)
      const centralGlow = ctx.createRadialGradient(targetX, targetY, 0, targetX, targetY, 50);
      centralGlow.addColorStop(0, 'hsla(200, 80%, 70%, 0.4)');
      centralGlow.addColorStop(0.5, 'hsla(180, 70%, 60%, 0.2)');
      centralGlow.addColorStop(1, 'hsla(180, 70%, 60%, 0)');
      
      ctx.fillStyle = centralGlow;
      ctx.fillRect(targetX - 50, targetY - 50, 100, 100);

      // Add floating particles around the convergence point
      for (let i = 0; i < 20; i++) {
        const angle = Date.now() * 0.001 + i * 0.5;
        const radius = 30 + Math.sin(Date.now() * 0.002 + i) * 10;
        const x = targetX + Math.cos(angle) * radius;
        const y = targetY + Math.sin(angle) * radius;
        const size = Math.random() * 2 + 1;
        
        ctx.fillStyle = `hsla(200, 80%, 70%, ${Math.random() * 0.6 + 0.2})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      animationId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [width, height, beamCount, speed]);

  return (
    <div className="flex items-center justify-center bg-transparent rounded-lg overflow-hidden">
      <canvas
        ref={canvasRef}
        className="block"
        style={{ 
          filter: 'contrast(1.1) brightness(1.2)',
        }}
      />
    </div>
  );
}
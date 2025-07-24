import { useEffect, useRef } from 'react';

interface CityLightBeamsProps {
  width?: number;
  height?: number;
  beamCount?: number;
  speed?: number;
}

export function CityLightBeams({ 
  width = 1920, 
  height = 1080, 
  beamCount = 50,
  speed = 2
}: CityLightBeamsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;

    // Light beam structure
    interface LightBeam {
      x: number;
      y: number;
      height: number;
      width: number;
      opacity: number;
      speed: number;
      color: string;
    }

    const beams: LightBeam[] = [];

    // Initialize light beams
    for (let i = 0; i < beamCount; i++) {
      beams.push({
        x: Math.random() * width,
        y: Math.random() * height,
        height: Math.random() * 200 + 100,
        width: Math.random() * 4 + 1,
        opacity: Math.random() * 0.8 + 0.2,
        speed: Math.random() * speed + 0.5,
        color: `hsl(${180 + Math.random() * 60}, 70%, 60%)` // Cyan to blue range
      });
    }

    let animationId: number;

    function draw() {
      // Clear canvas with dark background
      ctx.fillStyle = 'rgba(10, 20, 40, 0.1)';
      ctx.fillRect(0, 0, width, height);

      // Draw city silhouette at bottom
      const cityHeight = height * 0.3;
      const gradient = ctx.createLinearGradient(0, height - cityHeight, 0, height);
      gradient.addColorStop(0, 'rgba(20, 40, 80, 0.8)');
      gradient.addColorStop(1, 'rgba(10, 20, 50, 1)');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, height - cityHeight, width, cityHeight);

      // Draw buildings silhouette
      ctx.fillStyle = 'rgba(5, 15, 35, 0.9)';
      for (let i = 0; i < 20; i++) {
        const buildingWidth = width / 20;
        const buildingHeight = Math.random() * cityHeight * 0.8 + 50;
        ctx.fillRect(i * buildingWidth, height - buildingHeight, buildingWidth - 2, buildingHeight);
      }

      // Draw and animate light beams
      beams.forEach((beam) => {
        // Create gradient for the beam
        const beamGradient = ctx.createLinearGradient(
          beam.x, beam.y + beam.height,
          beam.x, beam.y
        );
        beamGradient.addColorStop(0, `hsla(200, 70%, 60%, 0)`);
        beamGradient.addColorStop(0.5, `hsla(200, 70%, 60%, ${beam.opacity})`);
        beamGradient.addColorStop(1, `hsla(180, 80%, 70%, ${beam.opacity * 0.8})`);

        ctx.fillStyle = beamGradient;
        
        // Draw main beam
        ctx.fillRect(beam.x - beam.width/2, beam.y, beam.width, beam.height);
        
        // Add glow effect
        ctx.shadowBlur = 20;
        ctx.shadowColor = beam.color;
        ctx.fillRect(beam.x - beam.width/4, beam.y, beam.width/2, beam.height);
        ctx.shadowBlur = 0;

        // Add bright core
        ctx.fillStyle = `hsla(180, 90%, 80%, ${beam.opacity * 0.6})`;
        ctx.fillRect(beam.x - beam.width/6, beam.y, beam.width/3, beam.height);

        // Move beam upward
        beam.y -= beam.speed;
        
        // Reset beam when it goes off screen
        if (beam.y + beam.height < 0) {
          beam.y = height;
          beam.x = Math.random() * width;
          beam.height = Math.random() * 200 + 100;
          beam.opacity = Math.random() * 0.8 + 0.2;
          beam.speed = Math.random() * speed + 0.5;
        }
      });

      // Add floating particles
      for (let i = 0; i < 30; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const size = Math.random() * 2 + 0.5;
        
        ctx.fillStyle = `hsla(200, 80%, 70%, ${Math.random() * 0.5 + 0.2})`;
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
    <div className="flex items-center justify-center bg-gradient-to-b from-slate-900 to-blue-900 rounded-lg overflow-hidden">
      <canvas
        ref={canvasRef}
        className="block"
        style={{ 
          filter: 'contrast(1.1) brightness(1.2)',
          background: 'radial-gradient(ellipse at bottom, #1e3a8a 0%, #0f172a 70%)'
        }}
      />
    </div>
  );
}
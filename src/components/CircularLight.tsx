import { useEffect, useRef } from 'react';

interface CircularLightProps {
  size?: number;
}

export function CircularLight({ size = 400 }: CircularLightProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = size;
    canvas.height = size;

    let rotation = 0;
    let pulseTime = 0;
    let animationId: number;

    const centerX = size / 2;
    const centerY = size / 2;

    function draw3DCircle() {
      // Clear canvas
      ctx.clearRect(0, 0, size, size);

      // Pulse effect
      const pulse = Math.sin(pulseTime * 0.03) * 0.3 + 1;
      const innerPulse = Math.sin(pulseTime * 0.05) * 0.2 + 1;

      // Draw multiple layered circles for 3D depth effect
      
      // Outer glow ring
      const outerGlow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 120 * pulse);
      outerGlow.addColorStop(0, 'rgba(0, 255, 255, 0)');
      outerGlow.addColorStop(0.7, 'rgba(0, 200, 255, 0.1)');
      outerGlow.addColorStop(0.9, 'rgba(0, 150, 255, 0.3)');
      outerGlow.addColorStop(1, 'rgba(0, 100, 255, 0)');
      
      ctx.fillStyle = outerGlow;
      ctx.fillRect(0, 0, size, size);

      // Main 3D ring structure
      for (let i = 0; i < 4; i++) {
        const ringRadius = 80 - (i * 15);
        const ringOpacity = 0.8 - (i * 0.15);
        
        // Ring gradient for 3D effect
        const ringGradient = ctx.createRadialGradient(
          centerX, centerY, ringRadius - 8,
          centerX, centerY, ringRadius + 8
        );
        ringGradient.addColorStop(0, `rgba(0, 255, 255, 0)`);
        ringGradient.addColorStop(0.3, `rgba(0, 220, 255, ${ringOpacity * pulse})`);
        ringGradient.addColorStop(0.7, `rgba(0, 180, 255, ${ringOpacity * 0.8})`);
        ringGradient.addColorStop(1, `rgba(0, 255, 255, 0)`);
        
        ctx.strokeStyle = ringGradient;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(centerX, centerY, ringRadius * pulse, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Rotating energy particles in 3D orbit
      for (let orbit = 0; orbit < 3; orbit++) {
        const orbitRadius = 60 + (orbit * 25);
        const particleCount = 12 + (orbit * 8);
        const orbitSpeed = (orbit + 1) * 0.02;
        
        for (let i = 0; i < particleCount; i++) {
          const angle = (i / particleCount) * Math.PI * 2 + (rotation * orbitSpeed);
          
          // 3D perspective effect
          const zOffset = Math.sin(angle + (orbit * 0.5)) * 0.3;
          const perspectiveScale = 0.7 + zOffset * 0.3;
          const currentRadius = orbitRadius * perspectiveScale * pulse;
          
          const x = centerX + Math.cos(angle) * currentRadius;
          const y = centerY + Math.sin(angle) * currentRadius * 0.8; // Elliptical for 3D effect
          
          // Particle size based on z-depth
          const particleSize = (2 + orbit) * perspectiveScale;
          const alpha = (0.8 + zOffset * 0.4) * perspectiveScale;
          
          // Particle glow
          const particleGlow = ctx.createRadialGradient(x, y, 0, x, y, particleSize * 3);
          particleGlow.addColorStop(0, `rgba(0, 255, 255, ${alpha})`);
          particleGlow.addColorStop(0.5, `rgba(0, 200, 255, ${alpha * 0.6})`);
          particleGlow.addColorStop(1, 'rgba(0, 150, 255, 0)');
          
          ctx.fillStyle = particleGlow;
          ctx.beginPath();
          ctx.arc(x, y, particleSize * 3, 0, Math.PI * 2);
          ctx.fill();
          
          // Bright particle core
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
          ctx.beginPath();
          ctx.arc(x, y, particleSize * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Central core with 3D depth
      const coreGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 30 * innerPulse);
      coreGradient.addColorStop(0, `rgba(255, 255, 255, 0.9)`);
      coreGradient.addColorStop(0.2, `rgba(0, 255, 255, 0.8)`);
      coreGradient.addColorStop(0.6, `rgba(0, 200, 255, 0.4)`);
      coreGradient.addColorStop(1, 'rgba(0, 150, 255, 0)');
      
      ctx.fillStyle = coreGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 30 * innerPulse, 0, Math.PI * 2);
      ctx.fill();

      // Energy trails
      for (let i = 0; i < 6; i++) {
        const trailAngle = (rotation * 0.5) + (i * Math.PI / 3);
        const trailLength = 40;
        const startX = centerX + Math.cos(trailAngle) * 20;
        const startY = centerY + Math.sin(trailAngle) * 20;
        const endX = centerX + Math.cos(trailAngle) * (20 + trailLength);
        const endY = centerY + Math.sin(trailAngle) * (20 + trailLength);
        
        const trailGradient = ctx.createLinearGradient(startX, startY, endX, endY);
        trailGradient.addColorStop(0, 'rgba(0, 255, 255, 0.6)');
        trailGradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
        
        ctx.strokeStyle = trailGradient;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }

      rotation += 0.02;
      pulseTime += 1;
      animationId = requestAnimationFrame(draw3DCircle);
    }

    draw3DCircle();

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
          filter: 'drop-shadow(0 0 20px rgba(0, 255, 255, 0.6)) drop-shadow(0 0 40px rgba(0, 200, 255, 0.4))',
          opacity: 0.9
        }}
      />
    </div>
  );
}
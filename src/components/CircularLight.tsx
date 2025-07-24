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
    const sphereRadius = 80;

    // Create particles for the digital sphere
    const particles: Array<{
      x: number;
      y: number;
      z: number;
      originalX: number;
      originalY: number;
      originalZ: number;
      alpha: number;
    }> = [];

    // Generate particles on sphere surface
    for (let i = 0; i < 150; i++) {
      const phi = Math.acos(-1 + (2 * i) / 150);
      const theta = Math.sqrt(150 * Math.PI) * phi;
      
      const x = sphereRadius * Math.cos(theta) * Math.sin(phi);
      const y = sphereRadius * Math.sin(theta) * Math.sin(phi);
      const z = sphereRadius * Math.cos(phi);
      
      particles.push({
        x, y, z,
        originalX: x, originalY: y, originalZ: z,
        alpha: Math.random() * 0.8 + 0.2
      });
    }

    function drawDigitalSphere() {
      ctx.clearRect(0, 0, size, size);

      // Rotate sphere
      const rotationY = time * 0.008;
      const rotationX = time * 0.005;

      // Transform particles
      const transformedParticles = particles.map(particle => {
        // Apply rotation
        let x = particle.originalX;
        let y = particle.originalY;
        let z = particle.originalZ;

        // Rotate around Y axis
        const cosY = Math.cos(rotationY);
        const sinY = Math.sin(rotationY);
        const tempX = x * cosY - z * sinY;
        z = x * sinY + z * cosY;
        x = tempX;

        // Rotate around X axis
        const cosX = Math.cos(rotationX);
        const sinX = Math.sin(rotationX);
        const tempY = y * cosX - z * sinX;
        z = y * sinX + z * cosX;
        y = tempY;

        // Project to 2D with perspective
        const perspective = 300;
        const projectedX = centerX + (x * perspective) / (perspective + z);
        const projectedY = centerY + (y * perspective) / (perspective + z);
        const scale = perspective / (perspective + z);

        return {
          x: projectedX,
          y: projectedY,
          z: z,
          scale: scale,
          alpha: particle.alpha * (0.6 + scale * 0.4)
        };
      });

      // Sort particles by z-depth
      transformedParticles.sort((a, b) => a.z - b.z);

      // Draw connections between nearby particles
      ctx.strokeStyle = 'rgba(100, 200, 255, 0.3)';
      ctx.lineWidth = 0.8;
      
      for (let i = 0; i < transformedParticles.length; i++) {
        const particle1 = transformedParticles[i];
        if (particle1.z < -20) continue; // Don't draw back-facing connections
        
        for (let j = i + 1; j < transformedParticles.length; j++) {
          const particle2 = transformedParticles[j];
          if (particle2.z < -20) continue;
          
          const distance = Math.sqrt(
            Math.pow(particle1.x - particle2.x, 2) + 
            Math.pow(particle1.y - particle2.y, 2)
          );
          
          if (distance < 40) {
            const lineAlpha = (1 - distance / 40) * 0.4;
            ctx.strokeStyle = `rgba(100, 200, 255, ${lineAlpha})`;
            
            ctx.beginPath();
            ctx.moveTo(particle1.x, particle1.y);
            ctx.lineTo(particle2.x, particle2.y);
            ctx.stroke();
          }
        }
      }

      // Draw particles
      transformedParticles.forEach(particle => {
        if (particle.z < -50) return; // Don't draw particles too far back
        
        const particleSize = 1.5 * particle.scale;
        const glowSize = 4 * particle.scale;
        
        // Glow effect
        const gradient = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, glowSize
        );
        gradient.addColorStop(0, `rgba(150, 220, 255, ${particle.alpha})`);
        gradient.addColorStop(0.4, `rgba(100, 180, 255, ${particle.alpha * 0.6})`);
        gradient.addColorStop(1, 'rgba(50, 150, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, glowSize, 0, Math.PI * 2);
        ctx.fill();
        
        // Bright core
        ctx.fillStyle = `rgba(255, 255, 255, ${particle.alpha * 0.9})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particleSize, 0, Math.PI * 2);
        ctx.fill();
      });

      // Add scanning lines effect
      const scanlineY = (Math.sin(time * 0.02) + 1) * 0.5 * size;
      const scanGradient = ctx.createLinearGradient(0, scanlineY - 20, 0, scanlineY + 20);
      scanGradient.addColorStop(0, 'rgba(100, 200, 255, 0)');
      scanGradient.addColorStop(0.5, 'rgba(150, 220, 255, 0.3)');
      scanGradient.addColorStop(1, 'rgba(100, 200, 255, 0)');
      
      ctx.fillStyle = scanGradient;
      ctx.fillRect(0, scanlineY - 20, size, 40);

      time += 1;
      animationId = requestAnimationFrame(drawDigitalSphere);
    }

    drawDigitalSphere();

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
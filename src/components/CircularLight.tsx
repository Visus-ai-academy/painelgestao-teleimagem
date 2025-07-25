import { useEffect, useRef } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

interface CircularLightProps {
  size?: number;
}

export function CircularLight({ size }: CircularLightProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMobile = useIsMobile();
  
  // Ajustar tamanho baseado no dispositivo - aumentar 100% do tamanho anterior
  const adaptiveSize = size || (isMobile ? 176 : 442); // 88 * 2 = 176

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = adaptiveSize;
    canvas.height = adaptiveSize;

    let time = 0;
    let animationId: number;

    const centerX = adaptiveSize / 2;
    const centerY = adaptiveSize / 2;
    const globeRadius = isMobile ? 60 : 122; // 30 * 2 = 60

    // Convert lat/lon to 3D coordinates - corrigido para hemisfério sul
    function latLonTo3D(lat: number, lon: number, radius: number) {
      const latRad = (lat * Math.PI) / 180;
      const lonRad = (lon * Math.PI) / 180;
      
      // Coordenadas 3D padrão
      const x = radius * Math.cos(latRad) * Math.cos(lonRad);
      const y = -radius * Math.sin(latRad); // Y negativo para latitude negativa ficar embaixo
      const z = radius * Math.cos(latRad) * Math.sin(lonRad);
      
      return { x, y, z };
    }

    // Global connection points
    const connections = [
      // Brasil - organizados do norte ao sul
      { name: 'Manaus', lat: -3.1190, lon: -60.0217, isHub: false },
      { name: 'Recife', lat: -8.0476, lon: -34.8770, isHub: false },
      { name: 'Salvador', lat: -12.9714, lon: -38.5014, isHub: false },
      { name: 'Brasília', lat: -15.8267, lon: -47.9218, isHub: false },
      { name: 'Rio de Janeiro', lat: -22.9068, lon: -43.1729, isHub: false },
      { name: 'São Paulo', lat: -23.5505, lon: -46.6333, isHub: false },
      { name: 'Porto Alegre', lat: -30.0346, lon: -51.2177, isHub: false },
      
      // Mundo
      { name: 'Nova York', lat: 40.7128, lon: -74.0060, isHub: false },
      { name: 'Londres', lat: 51.5074, lon: -0.1278, isHub: false },
      { name: 'Paris', lat: 48.8566, lon: 2.3522, isHub: false },
      { name: 'Tóquio', lat: 35.6762, lon: 139.6503, isHub: false },
      { name: 'Dubai', lat: 25.2048, lon: 55.2708, isHub: false },
      { name: 'Sydney', lat: -33.8688, lon: 151.2093, isHub: false },
      { name: 'Los Angeles', lat: 34.0522, lon: -118.2437, isHub: false },
      { name: 'Frankfurt', lat: 50.1109, lon: 8.6821, isHub: false },
      { name: 'Singapura', lat: 1.3521, lon: 103.8198, isHub: false },
      { name: 'Toronto', lat: 43.6532, lon: -79.3832, isHub: false },
      { name: 'Buenos Aires', lat: -34.6118, lon: -58.3960, isHub: false },
      { name: 'Santiago', lat: -33.4489, lon: -70.6693, isHub: false },
      
      // Curitiba - Centro das conexões (região sul do Brasil)
      { name: 'Curitiba', lat: -25.4284, lon: -49.2733, isHub: true }
    ];

    // Generate continental grid points for Earth representation - focado nas Américas
    const earthPoints: Array<{x: number, y: number, z: number, alpha: number}> = [];
    for (let lat = -80; lat <= 80; lat += 8) {
      for (let lon = -180; lon <= 180; lon += 8) {
        const point3D = latLonTo3D(lat, lon, globeRadius);
        // Enfatizar continentes americanos e regiões importantes
        const isLand = Math.random() > 0.65 || 
                      // América do Sul (especialmente Brasil)
                      (lat > -60 && lat < 15 && lon > -85 && lon < -30) ||
                      // América do Norte
                      (lat > 10 && lat < 75 && lon > -140 && lon < -50) ||
                      // Europa/África
                      (lat > -40 && lat < 75 && lon > -15 && lon < 60) ||
                      // Ásia
                      (lat > -10 && lat < 75 && lon > 60 && lon < 150);
        
        // Maior densidade de pontos na América do Sul
        const isAmerica = (lat > -60 && lat < 15 && lon > -85 && lon < -30);
        const alpha = isLand ? (isAmerica ? 0.4 + Math.random() * 0.5 : 0.3 + Math.random() * 0.4) : 0.05;
        
        earthPoints.push({
          ...point3D,
          alpha: alpha
        });
      }
    }

    function drawFuturisticGlobe() {
      ctx.clearRect(0, 0, adaptiveSize, adaptiveSize);

      // Rotation - ajustado para rotação muito rápida (75% mais rápido)
      const baseRotationY = -Math.PI * 0.2; // Rotação para focar no Brasil
      const rotationY = baseRotationY + time * 0.01365; // Aumentado em 75%: 0.0078 * 1.75 = 0.01365
      const rotationX = Math.PI * 0.25 + Math.sin(time * 0.0055125) * 0.1; // Aumentado em 75%: 0.00315 * 1.75 = 0.0055125

      // Transform all points
      const transformedEarth = earthPoints.map(point => {
        let { x, y, z } = point;

        // Apply rotations
        const cosY = Math.cos(rotationY);
        const sinY = Math.sin(rotationY);
        const tempX = x * cosY - z * sinY;
        z = x * sinY + z * cosY;
        x = tempX;

        const cosX = Math.cos(rotationX);
        const sinX = Math.sin(rotationX);
        const tempY = y * cosX - z * sinX;
        z = y * sinX + z * cosX;
        y = tempY;

        // Project to 2D
        const perspective = 400;
        const projectedX = centerX + (x * perspective) / (perspective + z);
        const projectedY = centerY + (y * perspective) / (perspective + z);
        const scale = perspective / (perspective + z);

        return {
          x: projectedX,
          y: projectedY,
          z: z,
          scale: scale,
          alpha: point.alpha * (0.4 + scale * 0.6)
        };
      });

      // Transform connection points
      const transformedConnections = connections.map(conn => {
        const point3D = latLonTo3D(conn.lat, conn.lon, globeRadius);
        let { x, y, z } = point3D;

        // Apply same rotations
        const cosY = Math.cos(rotationY);
        const sinY = Math.sin(rotationY);
        const tempX = x * cosY - z * sinY;
        z = x * sinY + z * cosY;
        x = tempX;

        const cosX = Math.cos(rotationX);
        const sinX = Math.sin(rotationX);
        const tempY = y * cosX - z * sinX;
        z = y * sinX + z * cosX;
        y = tempY;

        const perspective = 400;
        const projectedX = centerX + (x * perspective) / (perspective + z);
        const projectedY = centerY + (y * perspective) / (perspective + z);
        const scale = perspective / (perspective + z);

        return {
          ...conn,
          x: projectedX,
          y: projectedY,
          z: z,
          scale: scale
        };
      });

      // Sort by z-depth
      transformedEarth.sort((a, b) => a.z - b.z);

      // Draw Earth surface points with enhanced 3D effect
      transformedEarth.forEach(point => {
        if (point.z < -80) return;
        
        const pointSize = 0.8 * point.scale;
        const alpha = point.alpha * Math.max(0.3, point.scale);
        const depthShading = Math.max(0.2, 1 - Math.abs(point.z) / 120);
        
        // Add depth-based color variation
        const colorIntensity = 100 + depthShading * 100;
        ctx.fillStyle = `rgba(${colorIntensity}, ${Math.min(255, colorIntensity + 50)}, ${Math.min(255, colorIntensity + 100)}, ${alpha})`;
        
        // Add subtle glow for 3D effect
        if (pointSize > 0.5) {
          ctx.shadowColor = `rgba(100, 200, 255, ${alpha * 0.5})`;
          ctx.shadowBlur = 2;
        }
        
        ctx.beginPath();
        ctx.arc(point.x, point.y, pointSize, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0; // Reset shadow
      });

      // Draw connection lines to Curitiba
      const curitiba = transformedConnections.find(c => c.isHub);
      if (curitiba) {
        transformedConnections.forEach(conn => {
          if (conn.isHub) return;
          
          // Calculate 3D distance and visibility
          const distance3D = Math.sqrt(
            Math.pow(curitiba.x - conn.x, 2) + 
            Math.pow(curitiba.y - conn.y, 2) + 
            Math.pow(curitiba.z - conn.z, 2)
          );
          
          // Show connections even when Curitiba is behind the globe
          const isVisible = conn.z > -80 && distance3D < 300;
          
          if (isVisible) {
            // Animated connection lines with 3D depth effect
            const connectionProgress = (Math.sin(time * 0.02 + conn.lat * 0.1) + 1) * 0.5;
            const depthFactor = Math.max(0.2, 1 - Math.abs(curitiba.z) / 150);
            const lineAlpha = 0.8 * connectionProgress * depthFactor * Math.max(0.3, (conn.scale + curitiba.scale) * 0.5);
            
            // Create 3D curved connection line
            const dx = curitiba.x - conn.x;
            const dy = curitiba.y - conn.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Arc height based on 3D distance and visibility
            const arcHeight = Math.min(60, distance * 0.2 + Math.abs(curitiba.z) * 0.1);
            const midX = conn.x + dx * 0.5;
            const midY = conn.y + dy * 0.5 - arcHeight;
            
            // Enhanced gradient with 3D depth
            const gradient = ctx.createLinearGradient(conn.x, conn.y, curitiba.x, curitiba.y);
            gradient.addColorStop(0, `rgba(0, 200, 255, ${lineAlpha * 0.4})`);
            gradient.addColorStop(0.3, `rgba(100, 255, 200, ${lineAlpha * 0.8})`);
            gradient.addColorStop(0.7, `rgba(200, 255, 150, ${lineAlpha})`);
            gradient.addColorStop(1, `rgba(255, 255, 100, ${lineAlpha})`);
            
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 2 * Math.max(0.5, Math.max(conn.scale, curitiba.scale)) * depthFactor;
            
            // Add glow effect for 3D depth
            ctx.shadowColor = 'rgba(100, 255, 200, 0.6)';
            ctx.shadowBlur = 8 * depthFactor;
            
            ctx.beginPath();
            ctx.moveTo(conn.x, conn.y);
            ctx.quadraticCurveTo(midX, midY, curitiba.x, curitiba.y);
            ctx.stroke();
            
            ctx.shadowBlur = 0; // Reset shadow
            
            // Enhanced animated particles with 3D effect
            const numParticles = 3;
            for (let i = 0; i < numParticles; i++) {
              const particleOffset = (connectionProgress + i * 0.3) % 1;
              const t = particleOffset;
              
              // Quadratic bezier curve calculation
              const particleX = (1 - t) * (1 - t) * conn.x + 2 * (1 - t) * t * midX + t * t * curitiba.x;
              const particleY = (1 - t) * (1 - t) * conn.y + 2 * (1 - t) * t * midY + t * t * curitiba.y;
              
              const particleAlpha = lineAlpha * (1 - Math.abs(t - 0.5) * 0.5);
              const particleSize = 2 + Math.sin(time * 0.1 + i) * 0.5;
              
              // Particle glow
              const particleGradient = ctx.createRadialGradient(
                particleX, particleY, 0,
                particleX, particleY, particleSize * 3
              );
              particleGradient.addColorStop(0, `rgba(255, 255, 255, ${particleAlpha})`);
              particleGradient.addColorStop(0.5, `rgba(200, 255, 200, ${particleAlpha * 0.7})`);
              particleGradient.addColorStop(1, `rgba(100, 200, 255, 0)`);
              
              ctx.fillStyle = particleGradient;
              ctx.beginPath();
              ctx.arc(particleX, particleY, particleSize * 3, 0, Math.PI * 2);
              ctx.fill();
              
              // Particle core
              ctx.fillStyle = `rgba(255, 255, 255, ${particleAlpha})`;
              ctx.beginPath();
              ctx.arc(particleX, particleY, particleSize, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        });
      }

      // Draw connection points with enhanced 3D visibility
      transformedConnections.forEach(conn => {
        if (conn.z < -120) return;
        
        const depthFactor = Math.max(0.2, 1 - Math.abs(conn.z) / 150);
        const pointSize = conn.isHub ? 8 * conn.scale * depthFactor : 4 * conn.scale * depthFactor;
        const pulseSize = conn.isHub ? pointSize + Math.sin(time * 0.05) * 3 * depthFactor : pointSize;
        
        // Enhanced glow effect with 3D depth
        const glowGradient = ctx.createRadialGradient(
          conn.x, conn.y, 0,
          conn.x, conn.y, pulseSize * 3
        );
        
        if (conn.isHub) {
          const hubAlpha = Math.max(0.4, depthFactor);
          glowGradient.addColorStop(0, `rgba(255, 255, 100, ${hubAlpha})`);
          glowGradient.addColorStop(0.3, `rgba(255, 200, 0, ${hubAlpha * 0.8})`);
          glowGradient.addColorStop(0.6, `rgba(255, 150, 0, ${hubAlpha * 0.5})`);
          glowGradient.addColorStop(1, 'rgba(255, 100, 0, 0)');
        } else {
          const connAlpha = Math.max(0.3, depthFactor * 0.8);
          glowGradient.addColorStop(0, `rgba(100, 200, 255, ${connAlpha})`);
          glowGradient.addColorStop(0.5, `rgba(0, 150, 255, ${connAlpha * 0.6})`);
          glowGradient.addColorStop(1, 'rgba(0, 100, 200, 0)');
        }
        
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(conn.x, conn.y, pulseSize * 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Core point with 3D effect
        const coreAlpha = Math.max(0.5, depthFactor);
        ctx.fillStyle = conn.isHub ? 
          `rgba(255, 255, 255, ${coreAlpha})` : 
          `rgba(200, 240, 255, ${coreAlpha * 0.9})`;
        
        // Add subtle shadow for depth
        if (conn.isHub) {
          ctx.shadowColor = 'rgba(255, 200, 0, 0.8)';
          ctx.shadowBlur = 10;
        }
        
        ctx.beginPath();
        ctx.arc(conn.x, conn.y, pulseSize * 0.4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0; // Reset shadow
      });

      // Draw globe outline
      ctx.strokeStyle = 'rgba(100, 200, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, globeRadius, 0, Math.PI * 2);
      ctx.stroke();

      time += 1;
      animationId = requestAnimationFrame(drawFuturisticGlobe);
    }

    drawFuturisticGlobe();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [adaptiveSize, isMobile]);

  return (
    <div className={`absolute pointer-events-none ${
      isMobile 
        ? 'left-[36%] top-[49%] transform -translate-x-1/2 -translate-y-1/2' 
        : 'left-[45%] top-[60%] transform -translate-x-1/2 -translate-y-1/2'
    }`}>
      <canvas
        ref={canvasRef}
        className="block max-w-full h-auto"
        style={{ 
          filter: 'drop-shadow(0 0 15px rgba(100, 200, 255, 0.5))',
          opacity: isMobile ? 0.5 : 0.8,
          maxWidth: isMobile ? '176px' : '442px',
          maxHeight: isMobile ? '176px' : '442px'
        }}
      />
    </div>
  );
}
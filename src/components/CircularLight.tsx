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

    let time = 0;
    let animationId: number;

    const centerX = size / 2;
    const centerY = size / 2;
    const globeRadius = 100;

    // Convert lat/lon to 3D coordinates
    function latLonTo3D(lat: number, lon: number, radius: number) {
      const latRad = (lat * Math.PI) / 180;
      const lonRad = (lon * Math.PI) / 180;
      
      const x = radius * Math.cos(latRad) * Math.cos(lonRad);
      const y = radius * Math.sin(latRad);
      const z = radius * Math.cos(latRad) * Math.sin(lonRad);
      
      return { x, y, z };
    }

    // Global connection points
    const connections = [
      // Brasil
      { name: 'São Paulo', lat: -23.5505, lon: -46.6333, isHub: false },
      { name: 'Rio de Janeiro', lat: -22.9068, lon: -43.1729, isHub: false },
      { name: 'Brasília', lat: -15.8267, lon: -47.9218, isHub: false },
      { name: 'Salvador', lat: -12.9714, lon: -38.5014, isHub: false },
      { name: 'Recife', lat: -8.0476, lon: -34.8770, isHub: false },
      { name: 'Manaus', lat: -3.1190, lon: -60.0217, isHub: false },
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
      
      // Curitiba - Centro das conexões
      { name: 'Curitiba', lat: -25.4284, lon: -49.2733, isHub: true }
    ];

    // Generate continental grid points for Earth representation
    const earthPoints: Array<{x: number, y: number, z: number, alpha: number}> = [];
    for (let lat = -80; lat <= 80; lat += 10) {
      for (let lon = -180; lon <= 180; lon += 10) {
        const point3D = latLonTo3D(lat, lon, globeRadius);
        // Simulate continents with some randomness
        const isLand = Math.random() > 0.7 || 
                      (lat > -60 && lat < 70 && ((lon > -130 && lon < -30) || // Americas
                                                 (lon > -10 && lon < 60) ||   // Europe/Africa
                                                 (lon > 80 && lon < 150)));   // Asia
        earthPoints.push({
          ...point3D,
          alpha: isLand ? 0.3 + Math.random() * 0.4 : 0.1
        });
      }
    }

    function drawFuturisticGlobe() {
      ctx.clearRect(0, 0, size, size);

      // Rotation
      const rotationY = time * 0.003;
      const rotationX = Math.sin(time * 0.001) * 0.2;

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

      // Draw Earth surface points
      transformedEarth.forEach(point => {
        if (point.z < -50) return;
        
        const pointSize = 0.8 * point.scale;
        const alpha = point.alpha;
        
        ctx.fillStyle = `rgba(100, 150, 200, ${alpha})`;
        ctx.beginPath();
        ctx.arc(point.x, point.y, pointSize, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw connection lines to Curitiba
      const curitiba = transformedConnections.find(c => c.isHub);
      if (curitiba && curitiba.z > -50) {
        transformedConnections.forEach(conn => {
          if (conn.isHub || conn.z < -30) return;
          
          // Animated connection lines
          const connectionProgress = (Math.sin(time * 0.02 + conn.lat * 0.1) + 1) * 0.5;
          const lineAlpha = 0.6 * connectionProgress * Math.max(0, (conn.scale + curitiba.scale) * 0.5);
          
          if (lineAlpha > 0.1) {
            // Create curved connection line
            const midX = (conn.x + curitiba.x) / 2;
            const midY = (conn.y + curitiba.y) / 2 - 30; // Arc upward
            
            const gradient = ctx.createLinearGradient(conn.x, conn.y, curitiba.x, curitiba.y);
            gradient.addColorStop(0, `rgba(0, 200, 255, ${lineAlpha * 0.5})`);
            gradient.addColorStop(0.5, `rgba(100, 255, 200, ${lineAlpha})`);
            gradient.addColorStop(1, `rgba(255, 255, 100, ${lineAlpha})`);
            
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 1.5 * Math.max(conn.scale, curitiba.scale);
            
            ctx.beginPath();
            ctx.moveTo(conn.x, conn.y);
            ctx.quadraticCurveTo(midX, midY, curitiba.x, curitiba.y);
            ctx.stroke();
            
            // Animated particles along the line
            const particlePos = connectionProgress;
            const particleX = conn.x + (curitiba.x - conn.x) * particlePos;
            const particleY = conn.y + (curitiba.y - conn.y) * particlePos;
            
            ctx.fillStyle = `rgba(255, 255, 255, ${lineAlpha})`;
            ctx.beginPath();
            ctx.arc(particleX, particleY, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      }

      // Draw connection points
      transformedConnections.forEach(conn => {
        if (conn.z < -50) return;
        
        const pointSize = conn.isHub ? 8 * conn.scale : 4 * conn.scale;
        const pulseSize = conn.isHub ? pointSize + Math.sin(time * 0.05) * 3 : pointSize;
        
        // Glow effect
        const glowGradient = ctx.createRadialGradient(
          conn.x, conn.y, 0,
          conn.x, conn.y, pulseSize * 2
        );
        
        if (conn.isHub) {
          glowGradient.addColorStop(0, 'rgba(255, 255, 100, 0.9)');
          glowGradient.addColorStop(0.3, 'rgba(255, 200, 0, 0.7)');
          glowGradient.addColorStop(1, 'rgba(255, 100, 0, 0)');
        } else {
          glowGradient.addColorStop(0, 'rgba(100, 200, 255, 0.8)');
          glowGradient.addColorStop(0.5, 'rgba(0, 150, 255, 0.5)');
          glowGradient.addColorStop(1, 'rgba(0, 100, 200, 0)');
        }
        
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(conn.x, conn.y, pulseSize * 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Core point
        ctx.fillStyle = conn.isHub ? 'rgba(255, 255, 255, 1)' : 'rgba(200, 240, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(conn.x, conn.y, pulseSize * 0.3, 0, Math.PI * 2);
        ctx.fill();
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
import { useEffect, useRef } from 'react';

interface HandMovementProps {
  width?: number;
  height?: number;
}

export function HandMovement({ width = 400, height = 300 }: HandMovementProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;

    let time = 0;
    let animationId: number;

    // Finger positions (relative to hand position in image)
    const fingers = [
      { x: 80, y: 50, length: 40, baseAngle: -0.3, flexRange: 0.4 }, // Thumb
      { x: 120, y: 30, length: 50, baseAngle: 0.1, flexRange: 0.3 }, // Index
      { x: 150, y: 25, length: 55, baseAngle: 0, flexRange: 0.35 }, // Middle
      { x: 180, y: 30, length: 50, baseAngle: -0.1, flexRange: 0.3 }, // Ring
      { x: 205, y: 40, length: 40, baseAngle: -0.2, flexRange: 0.25 } // Pinky
    ];

    function drawMovingFingers() {
      ctx.clearRect(0, 0, width, height);

      fingers.forEach((finger, index) => {
        // Calculate finger movement with different timing for each finger
        const flexion = Math.sin(time * 0.02 + index * 0.8) * finger.flexRange;
        const angle = finger.baseAngle + flexion;

        // Draw finger segments (3 segments per finger)
        const segments = 3;
        const segmentLength = finger.length / segments;
        
        let currentX = finger.x;
        let currentY = finger.y;
        let currentAngle = angle;

        for (let segment = 0; segment < segments; segment++) {
          // Each segment bends more than the previous one
          const segmentFlex = flexion * (segment + 1) * 0.4;
          const segmentAngle = currentAngle + segmentFlex;
          
          const endX = currentX + Math.cos(segmentAngle) * segmentLength;
          const endY = currentY + Math.sin(segmentAngle) * segmentLength;

          // Draw finger segment with glow effect
          const gradient = ctx.createLinearGradient(currentX, currentY, endX, endY);
          gradient.addColorStop(0, 'rgba(100, 200, 255, 0.6)');
          gradient.addColorStop(1, 'rgba(150, 220, 255, 0.3)');
          
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 3 + Math.sin(time * 0.03 + index) * 0.5;
          ctx.lineCap = 'round';
          
          // Add glow effect
          ctx.shadowBlur = 8;
          ctx.shadowColor = 'rgba(100, 200, 255, 0.8)';
          
          ctx.beginPath();
          ctx.moveTo(currentX, currentY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
          
          // Reset shadow for next segment
          ctx.shadowBlur = 0;
          
          // Update position for next segment
          currentX = endX;
          currentY = endY;
          currentAngle = segmentAngle;
        }

        // Add fingertip glow
        ctx.fillStyle = `rgba(200, 240, 255, ${0.8 + Math.sin(time * 0.04 + index) * 0.2})`;
        ctx.beginPath();
        ctx.arc(currentX, currentY, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      // Add subtle energy lines between fingers
      for (let i = 0; i < fingers.length - 1; i++) {
        const finger1 = fingers[i];
        const finger2 = fingers[i + 1];
        
        const connectionOpacity = (Math.sin(time * 0.015 + i) + 1) * 0.1;
        
        ctx.strokeStyle = `rgba(100, 180, 255, ${connectionOpacity})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        
        ctx.beginPath();
        ctx.moveTo(finger1.x, finger1.y);
        ctx.lineTo(finger2.x, finger2.y);
        ctx.stroke();
        
        ctx.setLineDash([]); // Reset dash
      }

      time += 1;
      animationId = requestAnimationFrame(drawMovingFingers);
    }

    drawMovingFingers();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [width, height]);

  return (
    <div className="absolute bottom-32 left-16 pointer-events-none">
      <canvas
        ref={canvasRef}
        className="block"
        style={{ 
          filter: 'drop-shadow(0 0 10px rgba(100, 200, 255, 0.4))',
          opacity: 0.7
        }}
      />
    </div>
  );
}
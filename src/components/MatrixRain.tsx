import { useEffect, useRef } from 'react';

interface MatrixRainProps {
  width?: number;
  height?: number;
  speed?: number;
  fontSize?: number;
  opacity?: number;
}

export function MatrixRain({ 
  width = 400, 
  height = 300, 
  speed = 50, 
  fontSize = 14,
  opacity = 0.8
}: MatrixRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Characters for the matrix effect
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*(){}[]|<>?/\\~`+=";
    const charArray = chars.split("");

    const columns = Math.floor(width / fontSize);
    const drops: number[] = [];

    // Initialize drops array
    for (let i = 0; i < columns; i++) {
      drops[i] = Math.random() * height;
    }

    let animationId: number;

    function draw() {
      // Semi-transparent background to create fade effect
      ctx.fillStyle = `rgba(0, 0, 0, 0.05)`;
      ctx.fillRect(0, 0, width, height);

      // Green text
      ctx.fillStyle = `rgba(0, 255, 0, ${opacity})`;
      ctx.font = `${fontSize}px 'Courier New', monospace`;

      // Draw characters
      for (let i = 0; i < drops.length; i++) {
        const char = charArray[Math.floor(Math.random() * charArray.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        ctx.fillText(char, x, y);

        // Reset drop to top when it reaches bottom
        if (y > height && Math.random() > 0.975) {
          drops[i] = 0;
        }

        // Move drop down
        drops[i]++;
      }

      animationId = requestAnimationFrame(draw);
    }

    // Start animation
    draw();

    // Cleanup
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [width, height, speed, fontSize, opacity]);

  return (
    <div className="flex items-center justify-center bg-black rounded-lg overflow-hidden">
      <canvas
        ref={canvasRef}
        className="block"
        style={{ 
          filter: 'contrast(1.2) brightness(1.1)',
          background: '#000'
        }}
      />
    </div>
  );
}
import { useEffect, useState } from "react";

export function useMouseLight() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let animationFrameId: number;

    const updateMousePosition = (e: MouseEvent) => {
      cancelAnimationFrame(animationFrameId);
      
      animationFrameId = requestAnimationFrame(() => {
        setMousePosition({ x: e.clientX, y: e.clientY });
        setIsVisible(true);
      });
    };

    const hideMouseLight = () => {
      setIsVisible(false);
    };

    // Add event listeners
    document.addEventListener("mousemove", updateMousePosition);
    document.addEventListener("mouseleave", hideMouseLight);

    // Cleanup
    return () => {
      document.removeEventListener("mousemove", updateMousePosition);
      document.removeEventListener("mouseleave", hideMouseLight);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return { mousePosition, isVisible };
}
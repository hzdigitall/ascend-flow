import { useEffect, useRef } from "react";
import {
  createOrbitalSphereRenderer,
  ORBITAL_SPHERE_DEFAULTS,
  type OrbitalSphereOptions,
} from "@/components/ui/orbital-sphere-utils/orbitalSphereRenderer";

export type OrbitalSphereBackgroundProps = Partial<OrbitalSphereOptions> & {
  className?: string;
};

export function OrbitalSphereBackground({ className = "", ...props }: OrbitalSphereBackgroundProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const optionsRef = useRef<OrbitalSphereOptions>({ ...ORBITAL_SPHERE_DEFAULTS, ...props });
  optionsRef.current = { ...ORBITAL_SPHERE_DEFAULTS, ...props };

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return undefined;

    const renderer = createOrbitalSphereRenderer(canvas, () => optionsRef.current);
    let frame = 0;
    let visible = true;
    const reducedMotion =
      typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const bounds = host.getBoundingClientRect();
      renderer.resize(bounds.width, bounds.height);
      renderer.render();
    };

    const tick = () => {
      renderer.render();
      // Respeita "reduzir movimento" e pausa fora da tela / aba oculta.
      frame = visible && !document.hidden && !reducedMotion ? requestAnimationFrame(tick) : 0;
    };

    const resizeObserver = new ResizeObserver(resize);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      if (visible && !frame && !reducedMotion) frame = requestAnimationFrame(tick);
      if (!visible && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    });

    resizeObserver.observe(host);
    intersection.observe(host);
    resize();
    if (!reducedMotion) frame = requestAnimationFrame(tick);

    const onVisibility = () => {
      if (!document.hidden && visible && !frame && !reducedMotion) frame = requestAnimationFrame(tick);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibility);
      resizeObserver.disconnect();
      intersection.disconnect();
      renderer.dispose();
    };
  }, []);

  return (
    <div ref={hostRef} className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}

export default OrbitalSphereBackground;

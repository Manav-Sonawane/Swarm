import React, { useEffect, useRef, useCallback } from 'react';

/**
 * AtmosphericBackground
 *
 * Provides:
 * 1. Three enormous soft radial light orbs that shift position based on scroll
 * 2. A subtle cursor-following glow overlay
 * 3. Grain/noise texture overlay for depth
 * All GPU-friendly (transform/opacity only). Respects prefers-reduced-motion.
 */

interface OrbConfig {
  id: string;
  color: string;
  size: number;      // px
  blur: number;      // px
  opacity: number;
  xStart: number;    // vw %
  yStart: number;    // vh %
  xEnd: number;      // vw %
  yEnd: number;      // vh %
}

const ORBS: OrbConfig[] = [
  {
    id: 'orb-1',
    color: 'radial-gradient(ellipse, rgba(109,40,217,0.85) 0%, rgba(109,40,217,0) 70%)',
    size: 700,
    blur: 130,
    opacity: 0.16,
    xStart: 15, yStart: -5,
    xEnd: 60, yEnd: 55,
  },
  {
    id: 'orb-2',
    color: 'radial-gradient(ellipse, rgba(168,85,247,0.7) 0%, rgba(168,85,247,0) 70%)',
    size: 550,
    blur: 120,
    opacity: 0.10,
    xStart: 80, yStart: 25,
    xEnd: 20, yEnd: 70,
  },
  {
    id: 'orb-3',
    color: 'radial-gradient(ellipse, rgba(30,10,60,0.95) 0%, rgba(30,10,60,0) 70%)',
    size: 800,
    blur: 160,
    opacity: 0.25,
    xStart: 50, yStart: 90,
    xEnd: 40, yEnd: 20,
  },
  {
    id: 'orb-4',
    color: 'radial-gradient(ellipse, rgba(56,189,248,0.4) 0%, rgba(56,189,248,0) 70%)',
    size: 350,
    blur: 100,
    opacity: 0.07,
    xStart: 85, yStart: 75,
    xEnd: 10, yEnd: 15,
  },
];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export const AtmosphericBackground: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cursorGlowRef = useRef<HTMLDivElement>(null);
  const orbRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef<number>(0);
  const scrollRef = useRef(0);
  const cursorRef = useRef({ x: 50, y: 50 });
  const reducedMotion = useRef(
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  // Lerped values for smooth animation
  const lerpedScroll = useRef(0);
  const lerpedCursor = useRef({ x: 50, y: 50 });

  const updateOrbs = useCallback(() => {
    if (!containerRef.current) return;

    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const rawScroll = docHeight > 0 ? scrollRef.current / docHeight : 0;

    // Smooth lerp
    lerpedScroll.current = lerp(lerpedScroll.current, rawScroll, reducedMotion.current ? 1 : 0.04);
    lerpedCursor.current.x = lerp(lerpedCursor.current.x, cursorRef.current.x, reducedMotion.current ? 1 : 0.08);
    lerpedCursor.current.y = lerp(lerpedCursor.current.y, cursorRef.current.y, reducedMotion.current ? 1 : 0.08);

    const t = lerpedScroll.current;

    ORBS.forEach((orb, i) => {
      const el = orbRefs.current[i];
      if (!el) return;

      const x = lerp(orb.xStart, orb.xEnd, t);
      const y = lerp(orb.yStart, orb.yEnd, t);

      // Subtle breathing: intensity varies with scroll
      const intensityMod = 0.85 + Math.sin(t * Math.PI * 2) * 0.15;
      const opacity = orb.opacity * intensityMod;

      el.style.left = `${x}%`;
      el.style.top = `${y}%`;
      el.style.opacity = String(opacity);
    });

    // Update cursor glow
    if (cursorGlowRef.current) {
      cursorGlowRef.current.style.background = `radial-gradient(
        circle 280px at ${lerpedCursor.current.x}% ${lerpedCursor.current.y}%,
        rgba(124, 58, 237, 0.065) 0%,
        transparent 65%
      )`;
    }

    rafRef.current = requestAnimationFrame(updateOrbs);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      scrollRef.current = window.scrollY;
    };

    const handleMouseMove = (e: MouseEvent) => {
      cursorRef.current = {
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      };
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    rafRef.current = requestAnimationFrame(updateOrbs);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, [updateOrbs]);

  return (
    <>
      {/* Primary atmospheric orbs */}
      <div ref={containerRef} className="atm-bg" aria-hidden="true">

        {/* Deep space base gradient */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `
              radial-gradient(ellipse 80% 50% at 50% 0%, rgba(30,10,60,0.5) 0%, transparent 70%),
              radial-gradient(ellipse 60% 40% at 20% 100%, rgba(20,5,45,0.4) 0%, transparent 70%),
              linear-gradient(to bottom, #03020a, #05040e 40%, #03020a)
            `,
          }}
        />

        {/* Animated atmospheric orbs */}
        {ORBS.map((orb, i) => (
          <div
            key={orb.id}
            ref={(el) => { orbRefs.current[i] = el; }}
            style={{
              position: 'absolute',
              width: orb.size,
              height: orb.size,
              background: orb.color,
              borderRadius: '50%',
              filter: `blur(${orb.blur}px)`,
              opacity: orb.opacity,
              left: `${orb.xStart}%`,
              top: `${orb.yStart}%`,
              transform: 'translate(-50%, -50%)',
              mixBlendMode: 'screen',
              willChange: 'left, top, opacity',
              transition: reducedMotion.current ? 'none' : undefined,
            }}
          />
        ))}

        {/* Subtle noise grain texture */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat',
            opacity: 0.025,
            mixBlendMode: 'overlay',
            pointerEvents: 'none',
          }}
        />

        {/* Vignette */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse 100% 100% at 50% 50%, transparent 40%, rgba(3,2,10,0.7) 100%)',
          }}
        />
      </div>

      {/* Cursor glow overlay (sits above content but doesn't block interaction) */}
      <div
        ref={cursorGlowRef}
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 1,
          transition: 'background 0.05s linear',
        }}
        aria-hidden="true"
      />
    </>
  );
};

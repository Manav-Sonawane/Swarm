import React, { useCallback, useEffect, useRef } from 'react';

interface OrbConfig {
  id: string;
  color: string;
  size: number;
  blur: number;
  opacity: number;

  // Position across the page while scrolling
  xStart: number;
  yStart: number;
  xEnd: number;
  yEnd: number;

  // Independent animation
  driftX: number;
  driftY: number;
  duration: number;
  delay: number;
  parallax: number;
}

const ORBS: OrbConfig[] = [
  {
    id: 'violet',
    color: '#7c3aed',
    size: 760,
    blur: 115,
    opacity: 0.23,

    xStart: 8,
    yStart: 0,
    xEnd: 66,
    yEnd: 48,

    driftX: 55,
    driftY: 35,
    duration: 14,
    delay: 0,
    parallax: 1,
  },

  {
    id: 'purple',
    color: '#c026d3',
    size: 620,
    blur: 120,
    opacity: 0.13,

    xStart: 92,
    yStart: 20,
    xEnd: 15,
    yEnd: 72,

    driftX: -45,
    driftY: 50,
    duration: 18,
    delay: -5,
    parallax: 0.8,
  },

  {
    id: 'blue',
    color: '#2563eb',
    size: 470,
    blur: 105,
    opacity: 0.105,

    xStart: 110,
    yStart: 82,
    xEnd: 5,
    yEnd: 15,

    driftX: -65,
    driftY: -35,
    duration: 16,
    delay: -8,
    parallax: 1.15,
  },

  {
    id: 'cyan',
    color: '#38bdf8',
    size: 360,
    blur: 90,
    opacity: 0.085,

    xStart: 100,
    yStart: 70,
    xEnd: 10,
    yEnd: 12,

    driftX: -40,
    driftY: 45,
    duration: 12,
    delay: -2,
    parallax: 1.3,
  },

  {
    id: 'deep',
    color: '#17052f',
    size: 1000,
    blur: 170,
    opacity: 0.5,

    xStart: 50,
    yStart: 105,
    xEnd: 45,
    yEnd: 15,

    driftX: 30,
    driftY: -20,
    duration: 25,
    delay: -12,
    parallax: 0.35,
  },
];

const lerp = (
  a: number,
  b: number,
  amount: number
) => a + (b - a) * amount;

const clamp = (
  value: number,
  min: number,
  max: number
) => Math.min(Math.max(value, min), max);

export const AtmosphericBackground: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  const orbRefs = useRef<
    (HTMLDivElement | null)[]
  >([]);

  const cursorGlowRef =
    useRef<HTMLDivElement>(null);

  const cursorCoreRef =
    useRef<HTMLDivElement>(null);

  const auroraRef =
    useRef<HTMLDivElement>(null);

  const scanRef =
    useRef<HTMLDivElement>(null);

  const rafRef = useRef<number | null>(null);

  const scrollTarget = useRef(0);

  const mouseTarget = useRef({
    x: 50,
    y: 50,
  });

  const smooth = useRef({
    scroll: 0,
    x: 50,
    y: 50,
  });

  const reducedMotion = useRef(false);

  /*
   * ---------------------------------------------------------
   * MAIN ANIMATION LOOP
   * ---------------------------------------------------------
   */

  const animate = useCallback(
    (time: number) => {
      const container = containerRef.current;

      if (!container) return;

      const maxScroll =
        document.documentElement.scrollHeight -
        window.innerHeight;

      const scrollProgress =
        maxScroll > 0
          ? clamp(
              scrollTarget.current / maxScroll,
              0,
              1
            )
          : 0;

      /*
       * Smooth scrolling interpolation
       */
      smooth.current.scroll = lerp(
        smooth.current.scroll,
        scrollProgress,
        reducedMotion.current ? 1 : 0.055
      );

      /*
       * Smooth cursor interpolation
       */
      smooth.current.x = lerp(
        smooth.current.x,
        mouseTarget.current.x,
        reducedMotion.current ? 1 : 0.085
      );

      smooth.current.y = lerp(
        smooth.current.y,
        mouseTarget.current.y,
        reducedMotion.current ? 1 : 0.085
      );

      const t = smooth.current.scroll;

      /*
       * Global time.
       *
       * Dividing by 1000 makes the animation independent
       * from the frame rate.
       */
      const seconds = time / 1000;

      /*
       * -------------------------------------------------------
       * ORBS
       * -------------------------------------------------------
       */

      ORBS.forEach((orb, index) => {
        const el = orbRefs.current[index];

        if (!el) return;

        /*
         * Scroll position
         */
        const baseX = lerp(
          orb.xStart,
          orb.xEnd,
          t
        );

        const baseY = lerp(
          orb.yStart,
          orb.yEnd,
          t
        );

        /*
         * Large independent movement.
         *
         * This is what makes the animation clearly visible
         * even when the user isn't scrolling.
         */
        const angle =
          (seconds / orb.duration) *
          Math.PI *
          2 +
          orb.delay;

        const driftX =
          Math.sin(angle) *
          orb.driftX;

        const driftY =
          Math.cos(angle * 0.83) *
          orb.driftY;

        /*
         * Cursor influence.
         */
        const cursorX =
          (smooth.current.x - 50) *
          0.12 *
          orb.parallax;

        const cursorY =
          (smooth.current.y - 50) *
          0.08 *
          orb.parallax;

        /*
         * Subtle breathing.
         */
        const breathing =
          1 +
          Math.sin(
            seconds * 0.75 +
            index
          ) *
            0.055;

        /*
         * Small scale variation makes the lights feel
         * volumetric instead of like flat blobs.
         */
        const scale =
          breathing +
          Math.sin(
            seconds * 0.35 + index
          ) *
            0.025;

        const x =
          baseX -
          50 +
          driftX / 100 +
          cursorX / 10;

        const y =
          baseY -
          50 +
          driftY / 100 +
          cursorY / 10;

        el.style.transform = `
          translate3d(
            ${x}vw,
            ${y}vh,
            0
          )
          translate3d(-50%, -50%, 0)
          scale(${scale})
        `;

        /*
         * Slight intensity pulsing.
         */
        const pulse =
          0.94 +
          Math.sin(
            seconds * 0.65 + index * 1.7
          ) *
            0.06;

        el.style.opacity = String(
          orb.opacity * pulse
        );
      });

      /*
       * -------------------------------------------------------
       * AURORA
       * -------------------------------------------------------
       */

      if (auroraRef.current) {
        const ax =
          Math.sin(seconds * 0.12) * 4;

        const ay =
          Math.cos(seconds * 0.16) * 3;

        const rotate =
          Math.sin(seconds * 0.09) * 4;

        const scale =
          1 +
          Math.sin(seconds * 0.18) *
            0.045;

        auroraRef.current.style.transform = `
          translate3d(
            ${ax}%,
            ${ay}%,
            0
          )
          rotate(${rotate}deg)
          scale(${scale})
        `;
      }

      /*
       * -------------------------------------------------------
       * CURSOR GLOW
       * -------------------------------------------------------
       */

      if (cursorGlowRef.current) {
        const x = smooth.current.x;
        const y = smooth.current.y;

        cursorGlowRef.current.style.background = `
          radial-gradient(
            circle 300px at ${x}% ${y}%,
            rgba(139, 92, 246, 0.11) 0%,
            rgba(124, 58, 237, 0.045) 28%,
            rgba(56, 189, 248, 0.018) 45%,
            transparent 72%
          )
        `;
      }

      /*
       * Smaller bright cursor core.
       */
      if (
        cursorCoreRef.current &&
        !reducedMotion.current
      ) {
        const x = smooth.current.x;
        const y = smooth.current.y;

        cursorCoreRef.current.style.transform = `
          translate3d(
            ${x}vw,
            ${y}vh,
            0
          )
          translate3d(-50%, -50%, 0)
        `;
      }

      /*
       * -------------------------------------------------------
       * CINEMATIC SCAN
       * -------------------------------------------------------
       */

      if (
        scanRef.current &&
        !reducedMotion.current
      ) {
        const scan =
          ((seconds * 0.025) % 1) * 120 - 10;

        scanRef.current.style.transform = `
          translate3d(0, ${scan}%, 0)
        `;
      }

      rafRef.current =
        requestAnimationFrame(animate);
    },
    []
  );

  /*
   * ---------------------------------------------------------
   * EVENTS
   * ---------------------------------------------------------
   */

  useEffect(() => {
    const motionQuery =
      window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      );

    reducedMotion.current =
      motionQuery.matches;

    const handleMotionChange = (
      event: MediaQueryListEvent
    ) => {
      reducedMotion.current =
        event.matches;
    };

    const handleScroll = () => {
      scrollTarget.current =
        window.scrollY;
    };

    const handlePointerMove = (
      event: PointerEvent
    ) => {
      mouseTarget.current.x =
        (event.clientX /
          window.innerWidth) *
        100;

      mouseTarget.current.y =
        (event.clientY /
          window.innerHeight) *
        100;
    };

    motionQuery.addEventListener(
      'change',
      handleMotionChange
    );

    window.addEventListener(
      'scroll',
      handleScroll,
      { passive: true }
    );

    window.addEventListener(
      'pointermove',
      handlePointerMove,
      { passive: true }
    );

    rafRef.current =
      requestAnimationFrame(animate);

    return () => {
      motionQuery.removeEventListener(
        'change',
        handleMotionChange
      );

      window.removeEventListener(
        'scroll',
        handleScroll
      );

      window.removeEventListener(
        'pointermove',
        handlePointerMove
      );

      if (rafRef.current !== null) {
        cancelAnimationFrame(
          rafRef.current
        );
      }
    };
  }, [animate]);

  return (
    <>
      <div
        ref={containerRef}
        aria-hidden="true"
        className="atm-background"
      >
        {/* ===================================================
            BASE
        ==================================================== */}

        <div className="atm-base" />

        {/* ===================================================
            TOP PURPLE ATMOSPHERE
        ==================================================== */}

        <div
          ref={auroraRef}
          className="atm-aurora"
        />

        {/* ===================================================
            GLOW ORBS
        ==================================================== */}

        {ORBS.map((orb, index) => (
          <div
            key={orb.id}
            ref={(el) => {
              orbRefs.current[index] = el;
            }}
            className="atm-orb"
            style={
              {
                '--orb-color': orb.color,
                '--orb-size': `${orb.size}px`,
                '--orb-blur': `${orb.blur}px`,
                '--orb-opacity':
                  orb.opacity,
              } as React.CSSProperties
            }
          />
        ))}

        {/* ===================================================
            HORIZONTAL LIGHT RAY
        ==================================================== */}

        <div className="atm-light-ray" />

        {/* ===================================================
            MOVING SCAN
        ==================================================== */}

        <div
          ref={scanRef}
          className="atm-scan"
        />

        {/* ===================================================
            STARS / MICRO PARTICLES
        ==================================================== */}

        <div className="atm-stars atm-stars-1" />
        <div className="atm-stars atm-stars-2" />
        <div className="atm-stars atm-stars-3" />

        {/* ===================================================
            GRAIN
        ==================================================== */}

        <div className="atm-grain" />

        {/* ===================================================
            VIGNETTE
        ==================================================== */}

        <div className="atm-vignette" />

        {/* ===================================================
            CINEMATIC EDGE FADES
        ==================================================== */}

        <div className="atm-edge" />
      </div>

      {/* =====================================================
          CURSOR LIGHT
      ====================================================== */}

      <div
        ref={cursorGlowRef}
        className="atm-cursor-glow"
        aria-hidden="true"
      />

      <div
        ref={cursorCoreRef}
        className="atm-cursor-core"
        aria-hidden="true"
      />

      {/* =====================================================
          STYLES
      ====================================================== */}

      <style>{`
        /*
         * ====================================================
         * ROOT
         * ====================================================
         */

        .atm-background {
          position: fixed;
          inset: 0;

          width: 100%;
          height: 100%;

          overflow: hidden;

          pointer-events: none;

          z-index: 0;

          isolation: isolate;

          background: #020107;

          contain: strict;
        }


        /*
         * ====================================================
         * BASE
         * ====================================================
         */

        .atm-base {
          position: absolute;
          inset: 0;

          background:
            radial-gradient(
              ellipse 90% 60% at 50% -8%,
              rgba(76, 29, 149, 0.28) 0%,
              rgba(76, 29, 149, 0.08) 34%,
              transparent 70%
            ),

            radial-gradient(
              ellipse 70% 55% at 0% 100%,
              rgba(49, 12, 90, 0.22),
              transparent 70%
            ),

            radial-gradient(
              ellipse 60% 50% at 100% 20%,
              rgba(37, 99, 235, 0.075),
              transparent 72%
            ),

            linear-gradient(
              180deg,
              #020107 0%,
              #05030c 40%,
              #03020a 100%
            );
        }


        /*
         * ====================================================
         * AURORA
         * ====================================================
         */

        .atm-aurora {
          position: absolute;

          width: 110%;
          height: 65%;

          left: -5%;
          top: -18%;

          background:
            radial-gradient(
              ellipse at 50% 50%,
              rgba(139, 92, 246, 0.15) 0%,
              rgba(124, 58, 237, 0.065) 28%,
              rgba(168, 85, 247, 0.025) 48%,
              transparent 72%
            );

          filter: blur(55px);

          transform-origin: center;

          will-change: transform;

          mix-blend-mode: screen;
        }


        /*
         * ====================================================
         * ORBS
         * ====================================================
         */

        .atm-orb {
          position: absolute;

          left: 0;
          top: 0;

          width: var(--orb-size);
          height: var(--orb-size);

          border-radius: 50%;

          opacity: var(--orb-opacity);

          background:
            radial-gradient(
              ellipse at center,
              var(--orb-color) 0%,
              color-mix(
                in srgb,
                var(--orb-color) 70%,
                transparent
              ) 22%,
              color-mix(
                in srgb,
                var(--orb-color) 25%,
                transparent
              ) 48%,
              transparent 73%
            );

          filter:
            blur(var(--orb-blur));

          transform:
            translate3d(0, 0, 0)
            translate3d(-50%, -50%, 0);

          will-change:
            transform,
            opacity;

          mix-blend-mode: screen;

          backface-visibility: hidden;
        }


        /*
         * ====================================================
         * LIGHT RAY
         * ====================================================
         */

        .atm-light-ray {
          position: absolute;

          width: 130%;
          height: 28%;

          left: -15%;
          top: 35%;

          transform:
            rotate(-8deg)
            translateZ(0);

          background:
            linear-gradient(
              110deg,
              transparent 0%,
              rgba(124, 58, 237, 0.01) 28%,
              rgba(168, 85, 247, 0.045) 48%,
              rgba(56, 189, 248, 0.018) 60%,
              transparent 82%
            );

          filter: blur(45px);

          mix-blend-mode: screen;
        }


        /*
         * ====================================================
         * MOVING SCAN
         * ====================================================
         */

        .atm-scan {
          position: absolute;

          left: 0;
          top: -15%;

          width: 100%;
          height: 15%;

          background:
            linear-gradient(
              to bottom,
              transparent,
              rgba(168, 85, 247, 0.022),
              transparent
            );

          filter: blur(25px);

          will-change: transform;
        }


        /*
         * ====================================================
         * STARS
         * ====================================================
         */

        .atm-stars {
          position: absolute;
          inset: 0;

          pointer-events: none;

          background-repeat: repeat;

          mix-blend-mode: screen;

          opacity: 0.28;
        }

        .atm-stars-1 {
          background-image:
            radial-gradient(
              1px 1px at 20% 30%,
              rgba(255,255,255,0.55),
              transparent
            ),
            radial-gradient(
              1px 1px at 70% 20%,
              rgba(255,255,255,0.35),
              transparent
            ),
            radial-gradient(
              1px 1px at 90% 70%,
              rgba(167,139,250,0.45),
              transparent
            ),
            radial-gradient(
              1px 1px at 40% 80%,
              rgba(255,255,255,0.3),
              transparent
            );

          background-size:
            280px 280px,
            340px 340px,
            420px 420px,
            300px 300px;

          animation:
            atm-stars-drift-1
            32s
            linear
            infinite;
        }

        .atm-stars-2 {
          opacity: 0.16;

          background-image:
            radial-gradient(
              1px 1px at 15% 15%,
              rgba(255,255,255,0.8),
              transparent
            ),
            radial-gradient(
              1px 1px at 55% 65%,
              rgba(196,181,253,0.6),
              transparent
            ),
            radial-gradient(
              1px 1px at 80% 40%,
              rgba(255,255,255,0.5),
              transparent
            );

          background-size:
            500px 500px,
            650px 650px,
            750px 750px;

          animation:
            atm-stars-drift-2
            45s
            linear
            infinite;
        }

        .atm-stars-3 {
          opacity: 0.1;

          background-image:
            radial-gradient(
              2px 2px at 30% 60%,
              rgba(139,92,246,0.9),
              transparent
            ),
            radial-gradient(
              2px 2px at 80% 15%,
              rgba(56,189,248,0.7),
              transparent
            );

          background-size:
            900px 900px,
            1000px 1000px;

          animation:
            atm-stars-drift-3
            55s
            linear
            infinite;
        }


        /*
         * ====================================================
         * GRAIN
         * ====================================================
         */

        .atm-grain {
          position: absolute;
          inset: -50%;

          width: 200%;
          height: 200%;

          opacity: 0.018;

          background-image:
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");

          background-repeat: repeat;

          mix-blend-mode: soft-light;

          animation:
            atm-grain
            0.35s
            steps(2)
            infinite;
        }


        /*
         * ====================================================
         * VIGNETTE
         * ====================================================
         */

        .atm-vignette {
          position: absolute;
          inset: 0;

          background:
            radial-gradient(
              ellipse 78% 75% at 50% 50%,
              transparent 30%,
              rgba(2,1,7,0.1) 58%,
              rgba(2,1,7,0.45) 85%,
              rgba(2,1,7,0.72) 100%
            );
        }


        /*
         * ====================================================
         * EDGE FADE
         * ====================================================
         */

        .atm-edge {
          position: absolute;
          inset: 0;

          background:
            linear-gradient(
              to bottom,
              rgba(0,0,0,0.3),
              transparent 17%,
              transparent 83%,
              rgba(0,0,0,0.3)
            );
        }


        /*
         * ====================================================
         * CURSOR GLOW
         * ====================================================
         */

        .atm-cursor-glow {
          position: fixed;
          inset: 0;

          z-index: 1;

          pointer-events: none;

          mix-blend-mode: screen;

          will-change: background;
        }


        /*
         * Tiny bright center of cursor light.
         */

        .atm-cursor-core {
          position: fixed;

          left: 0;
          top: 0;

          width: 180px;
          height: 180px;

          border-radius: 50%;

          background:
            radial-gradient(
              circle,
              rgba(196,181,253,0.045) 0%,
              rgba(139,92,246,0.018) 25%,
              transparent 65%
            );

          transform:
            translate3d(50vw, 50vh, 0)
            translate3d(-50%, -50%, 0);

          pointer-events: none;

          z-index: 1;

          will-change: transform;

          mix-blend-mode: screen;
        }


        /*
         * ====================================================
         * ANIMATIONS
         * ====================================================
         */

        @keyframes atm-stars-drift-1 {
          from {
            background-position:
              0 0,
              0 0,
              0 0,
              0 0;
          }

          to {
            background-position:
              280px 180px,
              -340px 220px,
              420px -300px,
              -300px 250px;
          }
        }

        @keyframes atm-stars-drift-2 {
          from {
            background-position: 0 0, 0 0, 0 0;
          }

          to {
            background-position:
              -500px 300px,
              650px -400px,
              -750px 250px;
          }
        }

        @keyframes atm-stars-drift-3 {
          from {
            background-position: 0 0, 0 0;
          }

          to {
            background-position:
              900px -500px,
              -1000px 600px;
          }
        }

        @keyframes atm-grain {
          0% {
            transform: translate3d(0,0,0);
          }

          25% {
            transform: translate3d(-2%,1%,0);
          }

          50% {
            transform: translate3d(1%,-2%,0);
          }

          75% {
            transform: translate3d(2%,2%,0);
          }

          100% {
            transform: translate3d(-1%,-1%,0);
          }
        }


        /*
         * ====================================================
         * MOBILE
         * ====================================================
         */

        @media (max-width: 768px) {
          .atm-orb {
            filter:
              blur(
                calc(var(--orb-blur) * 0.75)
              );
          }

          .atm-cursor-glow,
          .atm-cursor-core {
            display: none;
          }

          .atm-stars {
            opacity: 0.18;
          }

          .atm-grain {
            opacity: 0.012;
          }
        }


        /*
         * ====================================================
         * REDUCED MOTION
         * ====================================================
         */

        @media (prefers-reduced-motion: reduce) {
          .atm-stars,
          .atm-grain {
            animation: none !important;
          }

          .atm-cursor-glow,
          .atm-cursor-core {
            display: none;
          }
        }
      `}</style>
    </>
  );
};

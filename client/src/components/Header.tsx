import React, { useRef } from 'react';
import { Truck, Activity, CloudRain, Zap, Award, Presentation } from 'lucide-react';
import { formatSimTime } from '../lib/format';

interface HeaderProps {
  connected: boolean;
  simTime: number;
  seed: number;
  activeScenario: string;
  weatherMult: number;
  onOpenScoreboard: () => void;
  onOpenPitchDeck: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  connected,
  simTime,
  seed,
  activeScenario,
  weatherMult,
  onOpenScoreboard,
  onOpenPitchDeck,
}) => {
  const scoreboardBtnRef = useRef<HTMLButtonElement>(null);
  const pitchBtnRef = useRef<HTMLButtonElement>(null);

  // Subtle magnetic button effect
  const handleMagneticMove = (ref: React.MutableRefObject<HTMLButtonElement | null>) => (e: React.MouseEvent<HTMLButtonElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) * 0.25;
    const dy = (e.clientY - cy) * 0.25;
    el.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  const handleMagneticLeave = (ref: React.MutableRefObject<HTMLButtonElement | null>) => () => {
    if (ref.current) {
      ref.current.style.transform = '';
    }
  };

  return (
    <header className="w-full glass-heavy border-b border-white/[0.08] px-6 py-3 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-40 shadow-glass-md">
      {/* Top sheen line */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      {/* Bottom subtle separator */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />

      {/* Left — Branding */}
      <div className="flex items-center gap-3">
        {/* Logo Icon */}
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 via-purple-500 to-cyan-400 p-[1.5px] shadow-[0_0_18px_rgba(124,58,237,0.4)]">
          <div className="w-full h-full bg-[#08070D] rounded-[10px] flex items-center justify-center">
            <Truck className="w-4.5 h-4.5 text-lavender-300" strokeWidth={2.5} />
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[1.05rem] font-extrabold tracking-[-0.03em] text-white leading-none"
                style={{ fontFamily: 'var(--font-primary)' }}>
              SWARM
            </h1>
            <span className="text-[10px] font-bold font-mono tracking-widest px-2 py-0.5 rounded-full bg-violet-500/15 text-lavender-300 border border-violet-500/30 shadow-[0_0_10px_rgba(124,58,237,0.2)] leading-none">
              v4.0
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-tight mt-0.5 tracking-[0.01em]"
             style={{ fontFamily: 'var(--font-primary)' }}>
            Mumbai Last-Mile · Live Digital Twin
          </p>
        </div>
      </div>

      {/* Center — Clock & Scenario */}
      <div className="flex items-center gap-3">
        {/* Digital Clock */}
        <div className="glass-light border border-white/10 rounded-xl px-3.5 py-2 flex items-center gap-2 shadow-glass-sm">
          <Activity className="w-3.5 h-3.5 text-cyan-accent animate-pulse flex-shrink-0" />
          <div>
            <span className="type-label text-slate-500 block leading-none mb-0.5">Sim Time</span>
            <span className="text-[1.1rem] font-bold font-mono text-white leading-none tracking-tight">
              {formatSimTime(simTime)}
            </span>
          </div>
        </div>

        {/* Seed pill */}
        <span className="text-[11px] font-mono px-3 py-1.5 rounded-xl glass-light border border-white/10 text-slate-300 leading-none">
          Seed <strong className="text-lavender-300">{seed}</strong>
        </span>

        {/* Scenario badges */}
        {weatherMult < 1.0 && (
          <span className="text-[11px] font-semibold px-3 py-1.5 rounded-xl bg-sky-950/60 border border-sky-400/30 text-sky-200 flex items-center gap-1.5 shadow-[0_0_15px_rgba(56,189,248,0.2)] animate-pulse leading-none">
            <CloudRain className="w-3.5 h-3.5 text-sky-300 flex-shrink-0" />
            Monsoon +50% ETAs
          </span>
        )}

        {activeScenario === 'spike' && (
          <span className="text-[11px] font-semibold px-3 py-1.5 rounded-xl bg-amber-950/60 border border-amber-400/30 text-amber-200 flex items-center gap-1.5 shadow-[0_0_15px_rgba(251,191,36,0.2)] animate-pulse leading-none">
            <Zap className="w-3.5 h-3.5 text-amber-300 flex-shrink-0" />
            IPL Spike 3x Rate
          </span>
        )}
      </div>

      {/* Right — Controls */}
      <div className="flex items-center gap-2.5">
        {/* Connection pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass-light border border-white/10">
          <div
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              connected ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
            }`}
          />
          <span className="text-[11px] font-medium text-slate-300">
            {connected ? 'Engine Live' : 'Disconnected'}
          </span>
        </div>

        {/* Pitch Deck */}
        <button
          ref={pitchBtnRef}
          onClick={onOpenPitchDeck}
          onMouseMove={handleMagneticMove(pitchBtnRef)}
          onMouseLeave={handleMagneticLeave(pitchBtnRef)}
          className="px-3.5 py-1.5 rounded-xl glass-light hover:glass-medium text-slate-200 hover:text-white border border-white/12 hover:border-violet-400/40 font-semibold text-[11px] flex items-center gap-1.5 transition-all duration-300 active:scale-95 shadow-glass-sm hover:shadow-[0_0_20px_rgba(124,58,237,0.25)]"
          style={{ transition: 'transform 0.25s cubic-bezier(0.22,0.61,0.36,1), box-shadow 0.3s, background 0.3s, border-color 0.3s' }}
        >
          <Presentation className="w-3.5 h-3.5 text-cyan-accent" />
          <span>Pitch Deck</span>
        </button>

        {/* Final Scoreboard */}
        <button
          ref={scoreboardBtnRef}
          onClick={onOpenScoreboard}
          onMouseMove={handleMagneticMove(scoreboardBtnRef)}
          onMouseLeave={handleMagneticLeave(scoreboardBtnRef)}
          className="glass-btn-primary px-4 py-1.5 text-[11px]"
          style={{ transition: 'transform 0.25s cubic-bezier(0.22,0.61,0.36,1), box-shadow 0.3s, background 0.3s' }}
        >
          <Award className="w-3.5 h-3.5 text-lavender-200" />
          <span>Scoreboard</span>
        </button>
      </div>
    </header>
  );
};

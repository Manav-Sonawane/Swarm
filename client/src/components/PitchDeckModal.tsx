import React, { useState, useEffect } from 'react';
import {
  X, ChevronLeft, ChevronRight, Presentation, ShieldAlert,
  Cpu, Navigation, Trophy, Sparkles, CheckCircle, Clock,
  ArrowRight, Layers, BarChart3, AlertTriangle, Zap, Lightbulb
} from 'lucide-react';

interface PitchDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PitchDeckModal: React.FC<PitchDeckModalProps> = ({ isOpen, onClose }) => {
  const [currentSlide, setCurrentSlide] = useState<number>(0);
  const [showNotes, setShowNotes] = useState<boolean>(false);

  const slides = [
    {
      number: 1,
      badge: '01 / THE PROBLEM',
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      title: 'The 10-Minute Myth: Fake Promises vs Harsh Reality',
      subtitle: 'Why existing quick-commerce dispatch engines fail under Mumbai traffic and weather spikes.',
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <div className="bg-slate-950/80 border border-rose-500/30 rounded-xl p-5 space-y-3">
            <div className="flex items-center space-x-2 text-rose-400 font-mono font-bold text-sm">
              <ShieldAlert className="w-4 h-4" />
              <span>Current Industry Status Quo</span>
            </div>
            <ul className="space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <li className="flex items-start space-x-2">
                <span className="text-rose-400 font-bold">•</span>
                <span><strong>Blind 10-min promises:</strong> Customers 2.5 km away at peak hour are promised 10 min, leading to 35% late deliveries.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-rose-400 font-bold">•</span>
                <span><strong>Greedy solo dispatch:</strong> Assigns the nearest rider regardless of dark store packing queues or batching potential.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-rose-400 font-bold">•</span>
                <span><strong>Disruption fragility:</strong> Monsoon rain or store outages cause catastrophic queue cascading.</span>
              </li>
            </ul>
          </div>

          <div className="bg-slate-950/80 border border-emerald-500/30 rounded-xl p-5 space-y-3">
            <div className="flex items-center space-x-2 text-emerald-400 font-mono font-bold text-sm">
              <Sparkles className="w-4 h-4" />
              <span>The Swarm Paradigm Shift</span>
            </div>
            <ul className="space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <li className="flex items-start space-x-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span><strong>Upfront feasibility honesty:</strong> Express vs Regular vs Infeasible classified instantly before checkout.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span><strong>End-to-end holistic ETA:</strong> Dark store queue time + rider pickup + delivery route + monsoon traffic multipliers.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span><strong>Reliability over vanity speed:</strong> On-time delivery rate & worst-case P90 lateness are the true north star.</span>
              </li>
            </ul>
          </div>
        </div>
      ),
      speakerNotes: 'Point out: Quick-commerce is not a shortest-path problem. A store 500m away with a 6-min packing queue loses to a store 1.5km away that packs instantly.',
    },
    {
      number: 2,
      badge: '02 / THE COUPLED DECISION',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      title: 'Store + Rider + Route Permutation in One Step',
      subtitle: 'Why independent sequential greedy heuristics fail and how Swarm couples the entire allocation.',
      content: (
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
              <div className="font-mono font-bold text-amber-400 mb-1 flex items-center space-x-1.5">
                <Layers className="w-4 h-4" />
                <span>1. Multi-Store Geofence</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Filter stores within 3 km with complete SKU inventory. Score dark stores by pack queue wait + road distance.
              </p>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
              <div className="font-mono font-bold text-sky-400 mb-1 flex items-center space-x-1.5">
                <Navigation className="w-4 h-4" />
                <span>2. Candidate Riders</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Select riders with capacity (&le;3 orders) and compatible dark store dispatch locations.
              </p>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
              <div className="font-mono font-bold text-emerald-400 mb-1 flex items-center space-x-1.5">
                <Cpu className="w-4 h-4" />
                <span>3. Permutation Insertion</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Test all drop permutations (&le;24 per rider). Filter with <strong>hard deadline constraints</strong> on all orders.
              </p>
            </div>
          </div>

          <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-4 text-xs font-mono text-amber-200 flex items-center justify-between">
            <div>
              <strong>Hard Deadline Invariant:</strong> If batching order B onto rider R makes order A 30s late, that option is strictly pruned before scoring!
            </div>
            <div className="text-[10px] bg-amber-500/20 px-2 py-1 rounded border border-amber-500/40 font-bold uppercase ml-3 shrink-0">
              Zero Late Batching
            </div>
          </div>
        </div>
      ),
      speakerNotes: 'Highlight: Hungarian algorithm and Dijkstra cannot solve this because Hungarian matches 1-to-1 without batching, while Dijkstra only provides point-to-point travel times.',
    },
    {
      number: 3,
      badge: '03 / ALGORITHM ARCHITECTURE',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      title: 'Rolling-Horizon Insertion & Dynamic Regret',
      subtitle: 'Sub-millisecond mathematical optimization with anti-churn stability guarantees.',
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 text-xs">
          <div className="space-y-3 bg-slate-950/80 border border-slate-800 rounded-xl p-4">
            <h4 className="font-mono font-bold text-emerald-400 flex items-center space-x-1.5">
              <Zap className="w-4 h-4" />
              <span>Regret-Based Priority Ordering</span>
            </h4>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Orders with the highest <em>regret</em> (difference between best and 2nd-best allocation cost) are assigned first. Scarce riders go to orders with fewest good alternatives.
            </p>
            <div className="bg-slate-900 p-2.5 rounded border border-slate-800 font-mono text-[10px] text-slate-300">
              Score = TravelSec + W_Load * Load - BatchSaving + LatenessPenalty
            </div>
          </div>

          <div className="space-y-3 bg-slate-950/80 border border-slate-800 rounded-xl p-4">
            <h4 className="font-mono font-bold text-teal-400 flex items-center space-x-1.5">
              <Clock className="w-4 h-4" />
              <span>Anti-Churn Freeze Window</span>
            </h4>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Every 60s rebalance reconsider unpicked orders. Orders within 300m of store or already packed are <strong>frozen</strong>. Others only move if gaining &ge;60s.
            </p>
            <div className="bg-slate-900 p-2.5 rounded border border-slate-800 font-mono text-[10px] text-teal-300">
              Prevents dispatch ping-pong & rider confusion
            </div>
          </div>
        </div>
      ),
      speakerNotes: 'Reassure judges on stability: We do not reassign riders haphazardly. The freeze window guarantees operational stability while still capturing dynamic optimization opportunities.',
    },
    {
      number: 4,
      badge: '04 / THE LIVE DIGITAL TWIN',
      badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
      title: 'Full Explainability & Live Disruption Injection',
      subtitle: 'Transparent real-time simulation across 15 Mumbai dark stores and 90 riders.',
      content: (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 text-xs">
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <span className="font-mono font-bold text-sky-400 block mb-1">Decision Drawer</span>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Click any live order to inspect all candidate stores, candidate riders, rejected infeasible options, and allocation latency in ms.
              </p>
            </div>
            <span className="text-[10px] text-slate-500 font-mono mt-2">100% Audit Transparency</span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <span className="font-mono font-bold text-amber-400 block mb-1">Disruption Stress Tests</span>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Inject monsoon downpours, store electrical outages, rider disconnects, and demand surges simultaneously in both worlds.
              </p>
            </div>
            <span className="text-[10px] text-slate-500 font-mono mt-2">Identical Shared Seed</span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <span className="font-mono font-bold text-emerald-400 block mb-1">Synchronized Twin</span>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Baseline (Greedy FIFO) vs Swarm (Rolling Insertion) run side-by-side on exact same customer order stream.
              </p>
            </div>
            <span className="text-[10px] text-slate-500 font-mono mt-2">Fair A/B Scientific Benchmark</span>
          </div>
        </div>
      ),
      speakerNotes: 'Show the Decision Drawer during demo: Judges love seeing WHY a specific rider and store was chosen and why other candidates were discarded.',
    },
    {
      number: 5,
      badge: '05 / EMPIRICAL RESULTS',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      title: 'Measured Superiority Across All Key Metrics',
      subtitle: 'Empirical benchmark results on Seed 42 and stress conditions.',
      content: (
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-xl p-3">
              <span className="text-[10px] font-mono uppercase text-emerald-400 block">On-Time Rate</span>
              <strong className="text-2xl font-black text-emerald-400 font-mono">+12% to +20%</strong>
              <span className="text-[10px] text-slate-400 block mt-0.5">84.1% vs 75.2%</span>
            </div>

            <div className="bg-teal-950/60 border border-teal-500/40 rounded-xl p-3">
              <span className="text-[10px] font-mono uppercase text-teal-400 block">P90 Lateness</span>
              <strong className="text-2xl font-black text-teal-400 font-mono">5x Lower</strong>
              <span className="text-[10px] text-slate-400 block mt-0.5">61s vs 335s</span>
            </div>

            <div className="bg-sky-950/60 border border-sky-500/40 rounded-xl p-3">
              <span className="text-[10px] font-mono uppercase text-sky-400 block">Decision Latency</span>
              <strong className="text-2xl font-black text-sky-400 font-mono">&lt; 15 ms</strong>
              <span className="text-[10px] text-slate-400 block mt-0.5">Budget: 200 ms</span>
            </div>

            <div className="bg-amber-950/60 border border-amber-500/40 rounded-xl p-3">
              <span className="text-[10px] font-mono uppercase text-amber-400 block">Trip Batching</span>
              <strong className="text-2xl font-black text-amber-400 font-mono">1.8x - 2.5x</strong>
              <span className="text-[10px] text-slate-400 block mt-0.5">Orders per trip</span>
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-300">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span><strong>Failed Deliveries:</strong> Swarm has <strong>0 failed deliveries</strong> vs 42 failed on Naive under inventory depletion.</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-1 rounded">
              Zero Stockout Failures
            </span>
          </div>
        </div>
      ),
      speakerNotes: 'Emphasize the decision latency: Our optimization runs in under 15 milliseconds, which is over 10x faster than the 200ms real-time requirement.',
    },
    {
      number: 6,
      badge: '06 / FUTURE ROADMAP',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      title: 'Production Scaling & Advanced Intelligence',
      subtitle: 'Path to deploying Swarm across 500+ micro-fulfillment nodes.',
      content: (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 text-xs">
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
            <div className="font-mono font-bold text-purple-400 mb-1 flex items-center space-x-1.5">
              <Lightbulb className="w-4 h-4" />
              <span>1. Demand Forecasting</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Pre-position idle riders toward micro-zones with high Poisson spike probabilities before surge orders trigger.
            </p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
            <div className="font-mono font-bold text-pink-400 mb-1 flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4" />
              <span>2. Rider Fatigue Routing</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Dynamically balance physical exertion, floor climbing, and monsoon exposure across fleet members.
            </p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
            <div className="font-mono font-bold text-indigo-400 mb-1 flex items-center space-x-1.5">
              <Layers className="w-4 h-4" />
              <span>3. Multi-Tier Hubs</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Orchestrate rapid mid-mile van shuttles feeding dark store inventory replenishment in real-time.
            </p>
          </div>
        </div>
      ),
      speakerNotes: 'Conclude with strong vision: Swarm transforms last-mile logistics from chaotic greedy dispatch into a synchronized, mathematically resilient digital organism.',
    },
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'ArrowRight' || e.key === 'Space') {
        setCurrentSlide(prev => Math.min(slides.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentSlide(prev => Math.max(0, prev - 1));
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, slides.length, onClose]);

  if (!isOpen) return null;

  const current = slides[currentSlide];

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-2xl z-50 flex items-center justify-center p-3 md:p-6 overflow-y-auto">
      <div className="glass-heavy border border-white/15 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-[0_0_60px_rgba(0,0,0,0.8)] relative overflow-hidden my-auto">
        {/* Decorative Atmospheric Glow */}
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-cyan-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 p-4 md:px-6 glass-light">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-violet-600 to-cyan-400 p-[1.5px] shadow-[0_0_15px_rgba(124,58,237,0.4)]">
              <div className="w-full h-full bg-[#08070D] rounded-[14px] flex items-center justify-center">
                <Presentation className="w-4 h-4 text-lavender-300 font-black" />
              </div>
            </div>
            <div>
              <h2 className="text-base font-black font-mono text-white tracking-tight flex items-center space-x-2">
                <span>SWARM ARCHITECTURE PITCH DECK</span>
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-violet-500/20 text-lavender-300 border border-violet-500/30">
                  6 Slides
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowNotes(!showNotes)}
              className={`px-3 py-1 rounded-xl text-xs font-mono font-semibold border transition-all ${
                showNotes
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                  : 'glass-light text-slate-300 border-white/10 hover:text-white hover:border-white/20'
              }`}
            >
              {showNotes ? 'Hide Judge Notes' : 'Show Judge Notes'}
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl glass-light text-slate-400 hover:text-white hover:border-white/20 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Slide Canvas */}
        <div className="flex-1 p-6 md:p-8 flex flex-col justify-between overflow-y-auto min-h-[380px]">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[10px] font-mono font-bold px-3 py-1 rounded-full border uppercase tracking-wider ${current.badgeColor}`}>
                {current.badge}
              </span>
              <span className="text-xs font-mono text-slate-400">
                Slide {currentSlide + 1} of {slides.length}
              </span>
            </div>

            <h3 className="text-xl md:text-2xl font-black font-mono text-white tracking-tight mt-2">
              {current.title}
            </h3>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              {current.subtitle}
            </p>

            <div className="mt-4">
              {current.content}
            </div>
          </div>

          {showNotes && (
            <div className="mt-4 p-4 glass-light border border-amber-500/30 rounded-2xl text-xs font-sans text-amber-200 flex items-start space-x-2.5 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
              <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-mono text-amber-300 block mb-0.5">Judge Pitch Note:</strong>
                <span>{current.speakerNotes}</span>
              </div>
            </div>
          )}
        </div>

        {/* Slide Navigation Footer */}
        <div className="flex items-center justify-between p-4 sm:px-6 border-t border-white/10 glass-light">
          <button
            onClick={() => setCurrentSlide(prev => Math.max(0, prev - 1))}
            disabled={currentSlide === 0}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold flex items-center space-x-1.5 transition-all ${
              currentSlide === 0
                ? 'opacity-30 cursor-not-allowed text-slate-600 glass-light border-transparent'
                : 'glass-light text-slate-200 hover:text-white hover:border-white/20 active:scale-95'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          {/* Slide Dots */}
          <div className="flex items-center space-x-2">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  idx === currentSlide
                    ? 'w-8 bg-gradient-to-r from-violet-500 to-cyan-300 shadow-[0_0_10px_rgba(139,92,246,0.6)]'
                    : 'w-2 bg-white/15 hover:bg-white/30'
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => setCurrentSlide(prev => Math.min(slides.length - 1, prev + 1))}
            disabled={currentSlide === slides.length - 1}
            className={`px-5 py-2 rounded-xl text-xs font-mono font-bold flex items-center space-x-1.5 transition-all ${
              currentSlide === slides.length - 1
                ? 'opacity-30 cursor-not-allowed text-slate-600 glass-light border-transparent'
                : 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-[0_0_15px_rgba(124,58,237,0.4)] active:scale-95'
            }`}
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
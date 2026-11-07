import React, { useState } from 'react';
import { 
  TrendingUp, Clock, ShieldCheck, Award, 
  ChevronDown, ChevronUp, Sparkles, CheckCircle2 
} from 'lucide-react';

export const InvestorDeckBar: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-ink-950 border-b border-white/[0.08] text-white text-xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between gap-3">
        {/* Left: Pitch Highlight Badge */}
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-amber-500/20 via-brand-500/20 to-emerald-500/20 border border-amber-400/30 text-amber-300 shadow-2xs">
            <Award className="w-3 h-3 text-amber-400" /> Executive Telemetry
          </span>
          <span className="hidden sm:inline text-zinc-400 text-xs">
            Deliberation Platform Metrics: <strong className="text-white font-semibold">Sub-60s Decision Velocity</strong>
          </span>
        </div>

        {/* Center / Stats Preview */}
        <div className="hidden md:flex items-center gap-5 text-[11px] text-zinc-300">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-brand-400" />
            <span>Avg. Time-to-Vote: <strong className="text-emerald-400 font-mono">38s</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Consensus Velocity: <strong className="text-white font-mono">4.2x Faster</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
            <span>Discourse Safety: <strong className="text-teal-300 font-mono">99.8%</strong></span>
          </div>
        </div>

        {/* Right: Expand Details */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-[11px] font-semibold text-brand-300 hover:text-white transition-all cursor-pointer"
        >
          <span>{isExpanded ? 'Hide KPI Dashboard' : 'View Product KPIs'}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expanded Deck Drawer */}
      {isExpanded && (
        <div className="bg-aurora-dark border-t border-white/[0.08] px-4 sm:px-6 py-5 animate-slide-up">
          <div className="max-w-6xl mx-auto space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-bold text-sm text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>The CivicPulse Advantage • Investor & Executive Summary</span>
                </h4>
                <p className="text-xs text-zinc-400">
                  Replacing stagnant committees and survey fatigue with instant binary decision velocity.
                </p>
              </div>
              <span className="text-[11px] font-mono text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-lg self-start sm:self-auto">
                ● Live Production Simulation
              </span>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div className="bg-white/[0.04] border border-white/10 rounded-xl p-3.5 space-y-1 backdrop-blur-md">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                  Decision Velocity
                </span>
                <div className="text-xl font-bold font-mono text-white flex items-baseline gap-1">
                  <span>38</span>
                  <span className="text-xs font-normal text-zinc-400">seconds</span>
                </div>
                <p className="text-[10px] text-zinc-400">Average time for a participant to cast a vote & attach reasoning.</p>
              </div>

              <div className="bg-white/[0.04] border border-white/10 rounded-xl p-3.5 space-y-1 backdrop-blur-md">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                  Vocal Sentiment
                </span>
                <div className="text-xl font-bold font-mono text-brand-300 flex items-baseline gap-1">
                  <span>31.4%</span>
                  <span className="text-xs font-normal text-emerald-400">↑ 12%</span>
                </div>
                <p className="text-[10px] text-zinc-400">Users attach a voice note with pitch-shifted privacy protection.</p>
              </div>

              <div className="bg-white/[0.04] border border-white/10 rounded-xl p-3.5 space-y-1 backdrop-blur-md">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                  Audience Versatility
                </span>
                <div className="text-xl font-bold font-mono text-purple-300 flex items-baseline gap-1">
                  <span>10+</span>
                  <span className="text-xs font-normal text-zinc-400">spheres</span>
                </div>
                <p className="text-[10px] text-zinc-400">Workplaces, families, HOAs, faith circles, universities & city boards.</p>
              </div>

              <div className="bg-white/[0.04] border border-white/10 rounded-xl p-3.5 space-y-1 backdrop-blur-md">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                  Civil Discourse Rate
                </span>
                <div className="text-xl font-bold font-mono text-emerald-400 flex items-baseline gap-1">
                  <span>99.8%</span>
                  <span className="text-xs font-normal text-zinc-400">clean</span>
                </div>
                <p className="text-[10px] text-zinc-400">Real-time content moderation blocks harassment & doxxing.</p>
              </div>
            </div>

            {/* Strategic Moat Highlights */}
            <div className="bg-gradient-to-r from-brand-950/60 via-purple-950/40 to-ink-900 p-3.5 rounded-xl border border-brand-500/20 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block">Binary Precision</strong>
                  <span className="text-[11px] text-zinc-400">Clean YES/NO eliminates ambiguity and forces actionable consensus.</span>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block">Biometric Voice Privacy</strong>
                  <span className="text-[11px] text-zinc-400">Web Audio filters disguise identity while preserving human emotional inflection.</span>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block">Time-Enforced Action</strong>
                  <span className="text-[11px] text-zinc-400">Strict deadlines prevent decision paralysis and automate archiving.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

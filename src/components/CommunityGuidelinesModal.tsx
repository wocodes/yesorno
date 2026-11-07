import React from 'react';
import { ShieldCheck, X, HeartHandshake, Volume2, EyeOff, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const CommunityGuidelinesModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/70 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div 
        className="relative w-full max-w-xl bg-white rounded-3xl shadow-lift border border-slate-200/80 overflow-hidden my-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guidelines-title"
      >
        {/* Header - Executive Glass Styling */}
        <div className="bg-gradient-to-r from-ink-950 via-ink-900 to-brand-950 text-white p-6 sm:p-7 relative">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
              <ShieldCheck className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-300 block">Civic Standard & Civility Guard</span>
              <h2 id="guidelines-title" className="text-xl sm:text-2xl font-bold tracking-tight text-white">Community Guidelines</h2>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
            CivicPulse is built on democratic participation, honesty, and mutual respect. We empower voices while strictly maintaining constructive civil discourse.
          </p>
        </div>

        {/* Content list */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto divide-y divide-slate-100 text-slate-700">
          {/* Rule 1 */}
          <div className="pt-2 first:pt-0 flex gap-4">
            <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-700 shrink-0 h-fit border border-emerald-100 shadow-2xs">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">1. Focus on Issues, Not People</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Debate ideas, policies, and community proposals. Never insult, demean, harass, or personally attack fellow residents, authors, or public figures.
              </p>
            </div>
          </div>

          {/* Rule 2 */}
          <div className="pt-4 flex gap-4">
            <div className="p-2.5 rounded-2xl bg-rose-50 text-rose-700 shrink-0 h-fit border border-rose-100 shadow-2xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">2. Zero Tolerance for Hate Speech & Abuse</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Slurs, discriminatory rhetoric based on race, gender, religion, sexual orientation, disability, or economic status are strictly filtered and removed.
              </p>
            </div>
          </div>

          {/* Rule 3 */}
          <div className="pt-4 flex gap-4">
            <div className="p-2.5 rounded-2xl bg-brand-50 text-brand-700 shrink-0 h-fit border border-brand-100 shadow-2xs">
              <EyeOff className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">3. Anonymous Expression With Accountability</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Anonymity exists to protect honest voter sentiment from social retaliation, not as a cover for malicious behavior. Anonymous votes and notes undergo identical safety moderation.
              </p>
            </div>
          </div>

          {/* Rule 4 */}
          <div className="pt-4 flex gap-4">
            <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-700 shrink-0 h-fit border border-amber-100 shadow-2xs">
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">4. Voice Note Etiquette</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Keep audio recordings clear, audible, and concise (under 60 seconds). Audio with screaming, background slurs, or loud disruptive sounds is subject to community reporting and review.
              </p>
            </div>
          </div>

          {/* Rule 5 */}
          <div className="pt-4 flex gap-4">
            <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-700 shrink-0 h-fit border border-blue-100 shadow-2xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">5. Privacy & Doxxing Protection</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Never publish phone numbers, home addresses, private emails, or personal identification without consent.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 bg-slate-50/80 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Automated & community-led moderation active</span>
          </div>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-500 hover:to-brand-600 text-white text-xs font-bold rounded-xl shadow-lift transition-all cursor-pointer"
          >
            I Understand & Agree
          </button>
        </div>
      </div>
    </div>
  );
};

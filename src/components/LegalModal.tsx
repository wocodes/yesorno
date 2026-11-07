import React, { useState, useEffect } from 'react';
import { X, Scale, Lock, ShieldCheck, CheckCircle2, FileText, Mic, Users, Globe } from 'lucide-react';

export type LegalDocTab = 'terms' | 'privacy';

interface Props {
  isOpen: boolean;
  initialTab?: LegalDocTab;
  onClose: () => void;
}

export const LegalModal: React.FC<Props> = ({
  isOpen,
  initialTab = 'terms',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<LegalDocTab>(initialTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-ink-950/75 backdrop-blur-md animate-fade-in overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
    >
      <div className="relative w-full max-w-2xl bg-white dark:bg-ink-900 rounded-3xl shadow-lift overflow-hidden my-6 flex flex-col max-h-[90vh] animate-slide-up">
        {/* Executive Header */}
        <div className="bg-gradient-to-r from-ink-950 via-ink-900 to-brand-950 text-white p-5 sm:p-6 relative">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-brand-500/20 text-brand-300">
              {activeTab === 'terms' ? <Scale className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-brand-300 block">
                YesOrNo Legal &amp; Trust Center
              </span>
              <h2 id="legal-modal-title" className="text-lg sm:text-xl font-extrabold tracking-tight text-white">
                {activeTab === 'terms' ? 'Terms of Use' : 'Privacy Policy'}
              </h2>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="grid grid-cols-2 gap-1.5 mt-4 bg-white/[0.08] p-1 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('terms')}
              className={`py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'terms'
                  ? 'bg-white text-ink-950 shadow-soft'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Terms of Use</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('privacy')}
              className={`py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'privacy'
                  ? 'bg-white text-ink-950 shadow-soft'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Privacy Policy</span>
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed flex-1">
          {activeTab === 'terms' ? (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-ink-950/70 text-xs text-slate-500 dark:text-zinc-400">
                <strong className="text-slate-800 dark:text-white">Effective Date:</strong> November 2026 • Welcome to <strong className="text-slate-800 dark:text-white">YesOrNo</strong>. By accessing or using YesOrNo, you agree to be bound by these Terms of Use.
              </div>

              <section className="space-y-1.5">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <Globe className="w-4 h-4 text-brand-500" />
                  <span>1. Purpose of the YesOrNo Platform</span>
                </h3>
                <p>
                  YesOrNo provides time-bound binary (YES/NO) polling, written perspectives, and up to 60-second voice notes for workplaces, families, communities, clubs, faith organizations, and private circles. Outcomes and AI-generated digests on YesOrNo are informational and deliberative and do not constitute binding legal or financial contracts unless independently ratified by your organization.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-500" />
                  <span>2. Member Accounts &amp; Eligibility</span>
                </h3>
                <p>
                  Access to view, create, and vote on issues requires an authenticated member account (via email or Google Sign-In). You are responsible for maintaining the confidentiality of your account credentials and for all activities conducted under your profile.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <Mic className="w-4 h-4 text-purple-500" />
                  <span>3. User-Generated Content, Voice Notes &amp; Moderation</span>
                </h3>
                <p>
                  You retain ownership of the issues, written notes, photos, and 60-second voice notes you submit. By posting on YesOrNo, you grant YesOrNo a non-exclusive license to display, process, and synthesize your contributions within the scope of the issue&apos;s visibility (Public or Private Circle). Hate speech, harassment, doxxing, and unlawful content are strictly prohibited and filtered by our automated and community moderation systems.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <Scale className="w-4 h-4 text-amber-500" />
                  <span>4. Issue Deletion &amp; Community Record Preservation</span>
                </h3>
                <p>
                  Issue creators may delete their issue topic and description at any time. To preserve the integrity of collective deliberation, deleting an issue replaces the title and description with <em>&ldquo;Deleted by Author&rdquo;</em> while preserving existing community vote tallies and participant responses.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  5. Limitation of Liability
                </h3>
                <p>
                  YesOrNo is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis without warranties of any kind. YesOrNo shall not be liable for any indirect, incidental, or consequential damages arising from collective decisions or user-contributed content on the platform.
                </p>
              </section>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-ink-950/70 text-xs text-slate-500 dark:text-zinc-400">
                <strong className="text-slate-800 dark:text-white">Last Updated:</strong> November 2026 • Your privacy and psychological safety are foundational to <strong className="text-slate-800 dark:text-white">YesOrNo</strong>.
              </div>

              <section className="space-y-1.5">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>1. Information We Collect</span>
                </h3>
                <p>
                  When you sign up or sign in with Google or email, we collect your display name, email address, optional role/headline, and your chosen feed preferences (primary region, topic interests, and followed creators). When you vote or propose issues, we store your vote choice, optional written perspective, and optional 60-second audio recording.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <Mic className="w-4 h-4 text-brand-500" />
                  <span>2. Anonymous Voting &amp; Voice Pitch Masking</span>
                </h3>
                <p>
                  When you choose to vote anonymously, YesOrNo assigns a randomized alias (e.g., <em>Neighbor #402</em>) so your public name and email are not displayed on the ballot thread. When you apply a Voice Privacy Filter (Deep Mask, Robotic, Helium, or Radio), audio pitch-shifting is performed directly in your browser using the Web Audio API before your voice note is saved, protecting your vocal identity.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <Lock className="w-4 h-4 text-purple-500" />
                  <span>3. Private Circles &amp; Access Controls</span>
                </h3>
                <p>
                  Issues marked as <strong>Private Circle</strong> are restricted solely to the creator, explicitly invited email addresses, and members of authorized groups. They are excluded from public social sharing.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  4. How We Use Your Data &amp; AI Synthesis
                </h3>
                <p>
                  We use your selected region and interests strictly to prioritize relevant issues in your ballot feed (mixing your region with Worldwide issues). Public written perspectives may be summarized into non-identifying executive pro/con digests. We never sell your personal data or audio recordings to third-party advertisers.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  5. Your Choices &amp; Data Control
                </h3>
                <p>
                  You can update your region, interests, followed creators, default anonymity setting, and default voice filter at any time from your <strong>Profile &amp; Preferences</strong> panel. Issue creators can also remove their issue topic and description at any time.
                </p>
              </section>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-ink-950 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>YesOrNo Privacy &amp; Governance Standard</span>
          </div>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-500 hover:to-brand-600 text-white text-xs font-bold rounded-xl shadow-lift transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};


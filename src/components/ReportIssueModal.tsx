import React, { useState } from 'react';
import { X, Flag, CheckCircle2 } from 'lucide-react';
import { Issue, IssueFlagReason, IssueFlagReport, UserProfile } from '../types';
import { recordIssueFlag } from '../utils/moderation';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  issue: Issue | null;
  currentUser: UserProfile | null;
  onReportSubmitted?: (issueId: string, updatedReport: IssueFlagReport) => void;
}

const REPORT_REASONS: { key: IssueFlagReason; label: string; desc: string; icon: string }[] = [
  {
    key: 'not_a_question',
    label: 'Not a Question / Rant',
    desc: 'Pure statement, complaint, or assertion not suitable for YES/NO voting',
    icon: '❓'
  },
  {
    key: 'inappropriate_language',
    label: 'Inappropriate or Abusive Language',
    desc: 'Contains vulgarity, slurs, profanity, or aggressive personal attacks',
    icon: '🚫'
  },
  {
    key: 'harassment_hate',
    label: 'Harassment or Hate Speech',
    desc: 'Attacks protected groups, incites hatred, or bullies individuals',
    icon: '🛑'
  },
  {
    key: 'spam_promotion',
    label: 'Spam or Commercial Promotion',
    desc: 'Unsolicited advertising, scam, referral links, or off-topic spam',
    icon: '📢'
  },
  {
    key: 'privacy_leak',
    label: 'Privacy Leak / Doxxing',
    desc: 'Reveals private telephone numbers, home addresses, or confidential emails',
    icon: '🔒'
  }
];

export const ReportIssueModal: React.FC<Props> = ({
  isOpen,
  onClose,
  issue,
  currentUser,
  onReportSubmitted
}) => {
  const [selectedReason, setSelectedReason] = useState<IssueFlagReason>('not_a_question');
  const [details, setDetails] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen || !issue) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const report: IssueFlagReport = {
      id: `report-${Date.now()}`,
      issueId: issue.id,
      reporterEmail: currentUser?.email || 'anonymous-reporter@civic.local',
      reason: selectedReason,
      details: details.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    recordIssueFlag(report);
    if (onReportSubmitted) {
      onReportSubmitted(issue.id, report);
    }

    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setDetails('');
      onClose();
    }, 1800);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-md bg-black border border-white/20 rounded-2xl shadow-2xl overflow-hidden p-5 sm:p-6 text-white animate-slide-up">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Flag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Report / Flag Issue</h3>
              <p className="text-xs text-zinc-400">Help protect the civic conversation</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-scale-in" />
            <h4 className="text-base font-bold text-white">Report Received</h4>
            <p className="text-xs text-zinc-400 max-w-xs">
              Thank you for keeping YesOrNo constructive. Our moderation team has been notified.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block mb-1">
                Target Issue
              </span>
              <p className="text-xs font-semibold text-zinc-200 line-clamp-2">
                &ldquo;{issue.title}&rdquo;
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-2">
                Why are you reporting this issue?
              </label>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {REPORT_REASONS.map((r) => {
                  const isSelected = selectedReason === r.key;
                  return (
                    <div
                      key={r.key}
                      onClick={() => setSelectedReason(r.key)}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex items-start gap-2.5 ${
                        isSelected
                          ? 'border-white bg-white/10 text-white'
                          : 'border-white/10 bg-white/[0.02] text-zinc-300 hover:border-white/30'
                      }`}
                    >
                      <span className="text-base leading-none mt-0.5">{r.icon}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold">{r.label}</div>
                        <div className="text-[11px] text-zinc-400 leading-tight mt-0.5">{r.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">
                Additional Context (Optional)
              </label>
              <textarea
                rows={2}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Briefly explain what's wrong with this issue..."
                className="w-full text-xs p-2.5 bg-white/[0.05] border border-white/15 rounded-xl text-white placeholder:text-zinc-500 focus:outline-none focus:border-white resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 rounded-full border border-white/20 text-xs font-bold text-zinc-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 px-4 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-lg"
              >
                Submit Report
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
